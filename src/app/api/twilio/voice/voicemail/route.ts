import { createVoiceResponse, validateTwilioRequest, twimlResponse } from "@/lib/twilio/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") ?? "";
  const response = createVoiceResponse();

  response.say("No one is available. Please leave a message after the beep.");
  response.record({
    action: `${url.origin}/api/twilio/voicemail?workerId=${encodeURIComponent(workerId)}`,
    maxLength: 120,
    recordingStatusCallback: `${url.origin}/api/twilio/voicemail?workerId=${encodeURIComponent(workerId)}`,
  });

  return twimlResponse(response.toString());
}
