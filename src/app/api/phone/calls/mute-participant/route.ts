import { NextResponse } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTwilioClient } from "@/lib/twilio/server";

export async function POST(request: Request) {
  const profile = await requireProfile();

  if (profile.role !== "worker") {
    return NextResponse.json({ error: "Worker access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    callSid?: string;
    conferenceName?: string;
    muted?: boolean;
  } | null;
  const callSid = String(body?.callSid ?? "").trim();
  const conferenceName = String(body?.conferenceName ?? "").trim();
  const muted = Boolean(body?.muted);

  if (!conferenceName.startsWith(`rm-support-${profile.id}-`)) {
    return NextResponse.json({ error: "This active call cannot be controlled." }, { status: 400 });
  }

  if (!callSid.startsWith("CA")) {
    return NextResponse.json({ error: "Choose a caller to mute." }, { status: 400 });
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

  const twilioClient = getTwilioClient();
  const conferences = await twilioClient.conferences.list({
    friendlyName: conferenceName,
    limit: 1,
    status: "in-progress",
  });
  const conference = conferences[0];

  if (!conference) {
    return NextResponse.json({ error: "The merged call is no longer active." }, { status: 404 });
  }

  await twilioClient
    .conferences(conference.sid)
    .participants(callSid)
    .update({ muted });

  return NextResponse.json({ callSid, muted, ok: true });
}
