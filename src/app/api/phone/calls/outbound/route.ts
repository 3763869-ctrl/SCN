import { NextResponse } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPhoneNumber } from "@/lib/twilio/server";

export async function POST(request: Request) {
  const profile = await requireProfile();

  if (profile.role !== "worker") {
    return NextResponse.json({ error: "Worker access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { to?: string } | null;
  const to = formatPhoneNumber(body?.to ?? "");

  if (!to || to.length < 8) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("worker_phone_settings")
    .select("phone_enabled, calling_enabled")
    .eq("worker_id", profile.id)
    .maybeSingle();

  if (!settings?.phone_enabled || !settings.calling_enabled) {
    return NextResponse.json(
      { error: "Phone calling is not enabled for this worker." },
      { status: 403 },
    );
  }

  await supabase.from("phone_call_logs").insert({
    direction: "outbound",
    from_number: profile.email,
    status: "initiated",
    to_number: to,
    worker_id: profile.id,
  });

  return NextResponse.json({ ok: true, to });
}
