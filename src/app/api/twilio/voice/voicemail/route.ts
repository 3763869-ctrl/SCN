import { createVoiceResponse, validateTwilioRequest, twimlResponse } from "@/lib/twilio/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneSystemSettings } from "@/lib/twilio/phone-flow";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") ?? "";
  const response = createVoiceResponse();
  const adminSupabase = createSupabaseAdminClient();
  const { data: phoneSystemData } = await adminSupabase
    .from("phone_system_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const phoneSystem = normalizePhoneSystemSettings(phoneSystemData);

  response.say(phoneSystem.voicemail_greeting);
  response.record({
    action: `${url.origin}/api/twilio/voicemail?workerId=${encodeURIComponent(workerId)}`,
    maxLength: 120,
    recordingStatusCallback: `${url.origin}/api/twilio/voicemail?workerId=${encodeURIComponent(workerId)}`,
  });

  return twimlResponse(response.toString());
}
