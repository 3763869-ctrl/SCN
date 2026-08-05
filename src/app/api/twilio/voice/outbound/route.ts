import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createVoiceResponse,
  formatPhoneNumber,
  getTwilioClient,
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
  const conferenceName = String(formData.get("ConferenceName") ?? "").trim();
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

  const origin = new URL(request.url).origin;

  if (conferenceName) {
    const participantResponse = createVoiceResponse();
    const participantDial = participantResponse.dial({
      record: "record-from-answer-dual",
      recordingStatusCallback: `${origin}/api/twilio/voicemail`,
    });

    participantDial.conference(
      {
        beep: "false",
        endConferenceOnExit: false,
        startConferenceOnEnter: true,
        statusCallback: `${origin}/api/twilio/voice/status`,
        statusCallbackEvent: ["start", "end", "join", "leave"],
      },
      conferenceName,
    );

    await getTwilioClient().calls.create({
      from: env.twilioPhoneNumber,
      statusCallback: `${origin}/api/twilio/voice/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      to,
      twiml: participantResponse.toString(),
    });

    const conferenceDial = response.dial();

    conferenceDial.conference(
      {
        beep: "false",
        endConferenceOnExit: true,
        startConferenceOnEnter: true,
      },
      conferenceName,
    );

    return twimlResponse(response.toString());
  }

  const dial = response.dial({
    callerId: env.twilioPhoneNumber || undefined,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${origin}/api/twilio/voicemail`,
  });
  dial.number(
    {
      statusCallback: `${origin}/api/twilio/voice/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    },
    to,
  );

  return twimlResponse(response.toString());
}
