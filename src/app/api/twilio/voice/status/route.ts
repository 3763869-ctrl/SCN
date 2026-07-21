import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const callSid = String(formData.get("CallSid") ?? "");
  const status = String(formData.get("CallStatus") ?? "");
  const duration = Number(formData.get("CallDuration") ?? 0);

  if (callSid) {
    const adminSupabase = createSupabaseAdminClient();
    await adminSupabase
      .from("phone_call_logs")
      .update({
        duration_seconds: Number.isFinite(duration) ? duration : null,
        status: status || "updated",
      })
      .eq("twilio_call_sid", callSid);
  }

  return new Response("OK");
}
