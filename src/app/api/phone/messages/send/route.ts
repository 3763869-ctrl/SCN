import { NextResponse } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatPhoneNumber,
  getTwilioClient,
  hasTwilioMessagingConfig,
} from "@/lib/twilio/server";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const profile = await requireProfile();

  if (profile.role !== "worker") {
    return NextResponse.json({ error: "Worker access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    body?: string;
    to?: string;
  } | null;
  const to = formatPhoneNumber(body?.to ?? "");
  const messageBody = String(body?.body ?? "").trim();

  if (!to || to.length < 8 || !messageBody) {
    return NextResponse.json(
      { error: "Enter a valid phone number and message." },
      { status: 400 },
    );
  }

  if (!hasTwilioMessagingConfig()) {
    return NextResponse.json(
      { error: "Twilio Messaging is not configured." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("worker_phone_settings")
    .select("phone_enabled, texting_enabled")
    .eq("worker_id", profile.id)
    .maybeSingle();

  if (!settings?.phone_enabled || !settings.texting_enabled) {
    return NextResponse.json(
      { error: "Texting is not enabled for this worker." },
      { status: 403 },
    );
  }

  const { data: thread } = await supabase
    .from("phone_message_threads")
    .upsert(
      {
        contact_number: to,
        last_message_at: new Date().toISOString(),
        worker_id: profile.id,
      },
      { onConflict: "worker_id,contact_number" },
    )
    .select("id")
    .single();

  if (!thread) {
    return NextResponse.json(
      { error: "Could not open message thread." },
      { status: 500 },
    );
  }

  const twilioClient = getTwilioClient();
  const sent = await twilioClient.messages.create({
    body: messageBody,
    from: env.twilioPhoneNumber,
    statusCallback: `${new URL(request.url).origin}/api/twilio/messages/status`,
    to,
  });

  await supabase.from("phone_messages").insert({
    body: messageBody,
    direction: "outbound",
    from_number: env.twilioPhoneNumber,
    status: sent.status,
    thread_id: thread.id,
    to_number: to,
    twilio_message_sid: sent.sid,
    worker_id: profile.id,
  });

  return NextResponse.json({ ok: true, sid: sent.sid });
}
