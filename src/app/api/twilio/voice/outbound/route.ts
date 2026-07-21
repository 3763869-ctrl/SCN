import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createVoiceResponse,
  formatPhoneNumber,
  getWorkerIdFromTwilioIdentity,
  validateTwilioRequest,
  twimlResponse,
} from "@/lib/twilio/server";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const to = formatPhoneNumber(String(formData.get("To") ?? ""));
  const workerId = getWorkerIdFromTwilioIdentity(
    String(formData.get("From") ?? formData.get("ClientIdentity") ?? ""),
  );
  const response = createVoiceResponse();

  if (!to || !workerId) {
    response.say("This call cannot be completed.");
    return twimlResponse(response.toString());
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: settings } = await adminSupabase
    .from("worker_phone_settings")
    .select("phone_enabled, calling_enabled")
    .eq("worker_id", workerId)
    .maybeSingle();

  if (!settings?.phone_enabled || !settings.calling_enabled) {
    response.say("Calling is not enabled.");
    return twimlResponse(response.toString());
  }

  const dial = response.dial({
    callerId: env.twilioPhoneNumber || undefined,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${new URL(request.url).origin}/api/twilio/voicemail`,
  });
  dial.number(
    {
      statusCallback: `${new URL(request.url).origin}/api/twilio/voice/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    },
    to,
  );

  return twimlResponse(response.toString());
}
