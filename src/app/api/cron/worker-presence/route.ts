import { NextResponse, type NextRequest } from "next/server";
import webPush, { type PushSubscription } from "web-push";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CHECK_INTERVAL_MS = 50 * 60 * 1000;
const RESPONSE_WINDOW_MS = 60 * 1000;
const MISSED_ADJUSTMENT_MS = 7.5 * 60 * 1000;

type OpenTimeEntry = {
  id: string;
  worker_id: string;
  clock_in_at: string;
};

function isCronAuthorized(request: NextRequest) {
  if (!env.cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return (
    authorization === `Bearer ${env.cronSecret}` || querySecret === env.cronSecret
  );
}

function configureWebPush() {
  if (!env.vapidPublicKey || !env.vapidPrivateKey || !env.vapidSubject) {
    return false;
  }

  webPush.setVapidDetails(
    env.vapidSubject,
    env.vapidPublicKey,
    env.vapidPrivateKey,
  );

  return true;
}

async function processExpiredChecks(now: Date) {
  const supabase = createSupabaseAdminClient();
  const { data: expiredChecks } = await supabase
    .from("worker_presence_checks")
    .select("id, worker_id, time_entry_id, expires_at")
    .in("status", ["scheduled", "sent"])
    .lte("expires_at", now.toISOString())
    .limit(100);
  let autoClockedOut = 0;
  let cancelled = 0;

  for (const check of expiredChecks ?? []) {
    const [{ data: entry }, { data: openBreak }] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id, worker_id, clock_in_at, clock_out_at")
        .eq("id", check.time_entry_id)
        .eq("worker_id", check.worker_id)
        .maybeSingle(),
      supabase
        .from("time_breaks")
        .select("id")
        .eq("worker_id", check.worker_id)
        .is("break_end_at", null)
        .limit(1),
    ]);

    if (!entry || entry.clock_out_at) {
      await supabase
        .from("worker_presence_checks")
        .update({
          failure_reason: "Time entry is already closed.",
          status: "cancelled",
        })
        .eq("id", check.id);
      cancelled += 1;
      continue;
    }

    if (openBreak?.length) {
      await supabase
        .from("worker_presence_checks")
        .update({
          failure_reason: "Worker is on lunch pause.",
          status: "cancelled",
        })
        .eq("id", check.id);
      cancelled += 1;
      continue;
    }

    const expiresAtMs = new Date(check.expires_at).getTime();
    const clockInMs = new Date(entry.clock_in_at).getTime();
    const adjustedClockOutAt = new Date(
      Math.max(clockInMs, expiresAtMs - MISSED_ADJUSTMENT_MS),
    );

    await supabase
      .from("time_entries")
      .update({
        clock_out_at: adjustedClockOutAt.toISOString(),
        notes: "Auto clocked out after missed SCN presence check.",
      })
      .eq("id", entry.id)
      .eq("worker_id", check.worker_id)
      .is("clock_out_at", null);

    await supabase
      .from("worker_presence_checks")
      .update({
        auto_clock_out_at: adjustedClockOutAt.toISOString(),
        status: "auto_clocked_out",
      })
      .eq("id", check.id);

    await supabase.from("admin_audit_events").insert({
      actor_id: check.worker_id,
      entity_id: entry.id,
      entity_type: "time_entry",
      event_type: "worker_presence.auto_clock_out",
      metadata: {
        checkId: check.id,
        expiresAt: check.expires_at,
      },
      summary: "Worker was auto clocked out after a missed presence check.",
    });

    autoClockedOut += 1;
  }

  return { autoClockedOut, cancelled };
}

async function getLastPresenceMoment(entry: OpenTimeEntry) {
  const supabase = createSupabaseAdminClient();
  const { data: latestCheck } = await supabase
    .from("worker_presence_checks")
    .select("status, sent_at, responded_at, created_at, expires_at")
    .eq("time_entry_id", entry.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestCheck) {
    return new Date(entry.clock_in_at);
  }

  if (["scheduled", "sent"].includes(latestCheck.status)) {
    return null;
  }

  return new Date(
    latestCheck.responded_at ??
      latestCheck.sent_at ??
      latestCheck.created_at ??
      entry.clock_in_at,
  );
}

async function sendPresenceChecks(now: Date) {
  const supabase = createSupabaseAdminClient();
  const { data: openEntries } = await supabase
    .from("time_entries")
    .select("id, worker_id, clock_in_at")
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: true });
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of openEntries ?? []) {
    const [{ data: profile }, { data: openBreak }, { data: subscriptions }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, role, active")
          .eq("id", entry.worker_id)
          .maybeSingle(),
        supabase
          .from("time_breaks")
          .select("id")
          .eq("worker_id", entry.worker_id)
          .is("break_end_at", null)
          .limit(1),
        supabase
          .from("worker_push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("worker_id", entry.worker_id)
          .eq("active", true),
      ]);

    if (profile?.role !== "worker" || !profile.active || openBreak?.length) {
      skipped += 1;
      continue;
    }

    const lastPresenceMoment = await getLastPresenceMoment(entry);

    if (!lastPresenceMoment) {
      skipped += 1;
      continue;
    }

    if (now.getTime() - lastPresenceMoment.getTime() < CHECK_INTERVAL_MS) {
      skipped += 1;
      continue;
    }

    if (!subscriptions?.length) {
      skipped += 1;
      continue;
    }

    const expiresAt = new Date(now.getTime() + RESPONSE_WINDOW_MS);
    const { data: check } = await supabase
      .from("worker_presence_checks")
      .insert({
        expires_at: expiresAt.toISOString(),
        metadata: {
          responseWindowSeconds: RESPONSE_WINDOW_MS / 1000,
          source: "vercel-cron",
        },
        scheduled_at: now.toISOString(),
        sent_at: now.toISOString(),
        status: "sent",
        time_entry_id: entry.id,
        worker_id: entry.worker_id,
      })
      .select("id")
      .single();

    if (!check) {
      failed += 1;
      continue;
    }

    const payload = JSON.stringify({
      body: "Press Yes within 1 minute or you will be clocked out.",
      checkId: check.id,
      title: "Are you still here?",
      type: "presence-check",
      url: "/worker",
    });
    let delivered = 0;

    for (const subscription of subscriptions) {
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      };

      try {
        await webPush.sendNotification(pushSubscription, payload);
        delivered += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error
            ? Number(error.statusCode)
            : 0;

        if ([404, 410].includes(statusCode)) {
          await supabase
            .from("worker_push_subscriptions")
            .update({ active: false })
            .eq("id", subscription.id);
        }
      }
    }

    if (delivered > 0) {
      sent += 1;
    } else {
      await supabase
        .from("worker_presence_checks")
        .update({
          failure_reason: "No active browser subscriptions accepted the push.",
          status: "failed",
        })
        .eq("id", check.id);
      failed += 1;
    }
  }

  return { failed, sent, skipped };
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!configureWebPush()) {
    return NextResponse.json(
      { error: "Web Push VAPID environment variables are missing." },
      { status: 500 },
    );
  }

  const now = new Date();
  const expired = await processExpiredChecks(now);
  const reminders = await sendPresenceChecks(now);

  return NextResponse.json({
    ok: true,
    ...expired,
    ...reminders,
  });
}
