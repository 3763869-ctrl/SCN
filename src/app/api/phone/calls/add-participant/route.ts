import { NextResponse } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import {
  createVoiceResponse,
  formatPhoneNumber,
  getTwilioClient,
} from "@/lib/twilio/server";

export async function POST(request: Request) {
  const profile = await requireProfile();

  if (profile.role !== "worker") {
    return NextResponse.json({ error: "Worker access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    conferenceName?: string;
    to?: string;
  } | null;
  const conferenceName = String(body?.conferenceName ?? "").trim();
  const to = formatPhoneNumber(body?.to ?? "");

  if (!conferenceName.startsWith(`rm-support-${profile.id}-`)) {
    return NextResponse.json({ error: "This active call cannot be merged." }, { status: 400 });
  }

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

  const origin = new URL(request.url).origin;
  const response = createVoiceResponse();
  const dial = response.dial({
    record: "record-from-answer-dual",
    recordingStatusCallback: `${origin}/api/twilio/voicemail`,
  });

  dial.conference(
    {
      beep: "false",
      endConferenceOnExit: false,
      startConferenceOnEnter: true,
      statusCallback: `${origin}/api/twilio/voice/status`,
      statusCallbackEvent: ["start", "end", "join", "leave"],
    },
    conferenceName,
  );

  const call = await getTwilioClient().calls.create({
    from: env.twilioPhoneNumber,
    statusCallback: `${origin}/api/twilio/voice/status`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    to,
    twiml: response.toString(),
  });

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from("phone_call_logs").insert({
    caller_name: "Merged call",
    direction: "outbound",
    from_number: profile.email,
    status: "initiated",
    to_number: to,
    twilio_call_sid: call.sid,
    worker_id: profile.id,
  });

  return NextResponse.json({ callSid: call.sid, ok: true, to });
}
