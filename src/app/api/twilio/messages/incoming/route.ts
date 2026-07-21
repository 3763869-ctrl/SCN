import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createMessagingResponse,
  validateTwilioRequest,
  twimlResponse,
} from "@/lib/twilio/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const from = String(formData.get("From") ?? "");
  const to = String(formData.get("To") ?? "");
  const body = String(formData.get("Body") ?? "");
  const messageSid = String(formData.get("MessageSid") ?? "");
  const adminSupabase = createSupabaseAdminClient();
  const { data: existingThread } = await adminSupabase
    .from("phone_message_threads")
    .select("worker_id")
    .eq("contact_number", from)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: existingWorkerSettings } = existingThread
    ? await adminSupabase
        .from("worker_phone_settings")
        .select("worker_id")
        .eq("worker_id", existingThread.worker_id)
        .eq("phone_enabled", true)
        .eq("texting_enabled", true)
        .maybeSingle()
    : { data: null };
  const { data: fallbackSettings } = existingWorkerSettings
    ? { data: null }
    : await adminSupabase
        .from("worker_phone_settings")
        .select("worker_id")
        .eq("phone_enabled", true)
        .eq("texting_enabled", true)
        .limit(1);
  const workerId = existingWorkerSettings?.worker_id ?? fallbackSettings?.[0]?.worker_id;

  if (workerId) {
    const { data: thread } = await adminSupabase
      .from("phone_message_threads")
      .upsert(
        {
          contact_number: from,
          last_message_at: new Date().toISOString(),
          worker_id: workerId,
        },
        { onConflict: "worker_id,contact_number" },
      )
      .select("id")
      .single();

    if (thread) {
      await adminSupabase.from("phone_messages").insert({
        body,
        direction: "inbound",
        from_number: from,
        status: "received",
        thread_id: thread.id,
        to_number: to,
        twilio_message_sid: messageSid || null,
        worker_id: workerId,
      });
    }
  }

  const response = createMessagingResponse();
  return twimlResponse(response.toString());
}
