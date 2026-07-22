import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createVoiceResponse,
  getWorkerTwilioIdentity,
  validateTwilioRequest,
  twimlResponse,
} from "@/lib/twilio/server";
import {
  isWithinBusinessHours,
  normalizePhoneSystemSettings,
  usesBusinessHours,
} from "@/lib/twilio/phone-flow";

async function isWorkerClockedIn(workerId: string) {
  const adminSupabase = createSupabaseAdminClient();
  const { data: openEntry } = await adminSupabase
    .from("time_entries")
    .select("id")
    .eq("worker_id", workerId)
    .is("clock_out_at", null)
    .maybeSingle();

  return Boolean(openEntry);
}

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
  const adminSupabase = createSupabaseAdminClient();
  const { data: phoneSystemData } = await adminSupabase
    .from("phone_system_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const phoneSystem = normalizePhoneSystemSettings(phoneSystemData);

  if (usesBusinessHours(phoneSystem) && !isWithinBusinessHours(phoneSystem)) {
    response.say(phoneSystem.after_hours_greeting);
    response.record({
      action: `${origin}/api/twilio/voicemail`,
      maxLength: 120,
      recordingStatusCallback: `${origin}/api/twilio/voicemail`,
    });
    return twimlResponse(response.toString());
  }

  if (!digits) {
    response
      .gather({
        action: `${origin}/api/twilio/voice/incoming`,
        input: ["dtmf"],
        method: "POST",
        numDigits: 4,
        timeout: 8,
      })
      .say(phoneSystem.working_hours_greeting);
    response.say(phoneSystem.voicemail_greeting);
    response.record({
      action: `${origin}/api/twilio/voicemail`,
      maxLength: 120,
      recordingStatusCallback: `${origin}/api/twilio/voicemail`,
    });
    return twimlResponse(response.toString());
  }

  const { data: setting } = await adminSupabase
    .from("worker_phone_settings")
    .select("worker_id, phone_enabled, calling_enabled, voicemail_greeting")
    .eq("extension", digits)
    .maybeSingle();

  if (!setting?.phone_enabled || !setting.calling_enabled) {
    response.say(phoneSystem.voicemail_greeting);
    response.record({
      action: `${origin}/api/twilio/voicemail?extension=${encodeURIComponent(digits)}`,
      maxLength: 120,
      recordingStatusCallback: `${origin}/api/twilio/voicemail?extension=${encodeURIComponent(digits)}`,
    });
    return twimlResponse(response.toString());
  }

  if (phoneSystem.availability_mode === "worker_clock") {
    const workerIsClockedIn = await isWorkerClockedIn(setting.worker_id);

    if (!workerIsClockedIn) {
      response.say(phoneSystem.after_hours_greeting);
      response.record({
        action: `${origin}/api/twilio/voicemail?extension=${encodeURIComponent(digits)}`,
        maxLength: 120,
        recordingStatusCallback: `${origin}/api/twilio/voicemail?extension=${encodeURIComponent(digits)}`,
      });
      return twimlResponse(response.toString());
    }
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
    timeout: phoneSystem.ring_timeout_seconds,
  });
  dial.client(getWorkerTwilioIdentity(setting.worker_id));

  return twimlResponse(response.toString());
}
