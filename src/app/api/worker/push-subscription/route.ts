import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PushSubscriptionPayload = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    auth?: string;
    p256dh?: string;
  };
};

export async function POST(request: NextRequest) {
  const profile = await requireProfile();
  const payload = (await request.json()) as PushSubscriptionPayload;

  if (!payload.endpoint || !payload.keys?.auth || !payload.keys.p256dh) {
    return NextResponse.json(
      { error: "Invalid notification subscription." },
      { status: 400 },
    );
  }

  const headerStore = await headers();
  const supabase = await createSupabaseServerClient();
  const expirationTime = payload.expirationTime
    ? new Date(payload.expirationTime).toISOString()
    : null;

  await supabase.from("worker_push_subscriptions").upsert(
    {
      active: true,
      auth: payload.keys.auth,
      endpoint: payload.endpoint,
      expiration_time: expirationTime,
      last_seen_at: new Date().toISOString(),
      p256dh: payload.keys.p256dh,
      user_agent: headerStore.get("user-agent"),
      worker_id: profile.id,
    },
    { onConflict: "endpoint" },
  );

  return NextResponse.json({ ok: true });
}
