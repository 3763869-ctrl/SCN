import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const messageSid = String(formData.get("MessageSid") ?? "");
  const status = String(formData.get("MessageStatus") ?? "");
  const errorMessage = String(formData.get("ErrorMessage") ?? "");

  if (messageSid) {
    const adminSupabase = createSupabaseAdminClient();
    await adminSupabase
      .from("phone_messages")
      .update({
        error_message: errorMessage || null,
        status: status || "updated",
      })
      .eq("twilio_message_sid", messageSid);
  }

  return new Response("OK");
}
