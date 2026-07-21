import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createVoiceResponse,
  getWorkerTwilioIdentity,
  validateTwilioRequest,
  twimlResponse,
} from "@/lib/twilio/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const digits = String(formData.get("Digits") ?? "").trim();
  const from = String(formData.get("From") ?? "");
  const callSid = String(formData.get("CallSid") ?? "");
  const response = createVoiceResponse();

  if (!digits) {
    response
      .gather({
        action: `${origin}/api/twilio/voice/incoming`,
        input: ["dtmf"],
        method: "POST",
        numDigits: 4,
        timeout: 8,
      })
      .say("Welcome to S C N. Please enter the worker extension.");
    response.say("No extension was entered. Please leave a voicemail after the beep.");
    response.record({
      action: `${origin}/api/twilio/voicemail`,
      maxLength: 120,
      recordingStatusCallback: `${origin}/api/twilio/voicemail`,
    });
    return twimlResponse(response.toString());
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: setting } = await adminSupabase
    .from("worker_phone_settings")
    .select("worker_id, phone_enabled, calling_enabled, voicemail_greeting")
    .eq("extension", digits)
    .maybeSingle();

  if (!setting?.phone_enabled || !setting.calling_enabled) {
    response.say("That extension is not available. Please leave a voicemail after the beep.");
    response.record({
      action: `${origin}/api/twilio/voicemail?extension=${encodeURIComponent(digits)}`,
      maxLength: 120,
      recordingStatusCallback: `${origin}/api/twilio/voicemail?extension=${encodeURIComponent(digits)}`,
    });
    return twimlResponse(response.toString());
  }

  await adminSupabase.from("phone_call_logs").insert({
    direction: "inbound",
    from_number: from || null,
    status: "ringing",
    to_number: digits,
    twilio_call_sid: callSid || null,
    worker_id: setting.worker_id,
  });

  const dial = response.dial({
    action: `${origin}/api/twilio/voice/voicemail?workerId=${setting.worker_id}`,
    method: "POST",
    timeout: 20,
  });
  dial.client(getWorkerTwilioIdentity(setting.worker_id));

  return twimlResponse(response.toString());
}
