import { createSupabaseServerClient } from "@/lib/supabase/server";
import { twilioConfigStatus } from "@/lib/twilio/server";

export async function getWorkerPhoneData(workerId: string) {
  const supabase = await createSupabaseServerClient();
  const [
    { data: settings },
    { data: callLogs },
    { data: threads },
    { data: messages },
    { data: voicemails },
  ] = await Promise.all([
    supabase
      .from("worker_phone_settings")
      .select(
        "worker_id, extension, phone_enabled, calling_enabled, texting_enabled, voicemail_greeting",
      )
      .eq("worker_id", workerId)
      .maybeSingle(),
    supabase
      .from("phone_call_logs")
      .select(
        "id, direction, from_number, to_number, caller_name, status, duration_seconds, created_at",
      )
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("phone_message_threads")
      .select("id, contact_number, contact_name, last_message_at")
      .eq("worker_id", workerId)
      .order("last_message_at", { ascending: false })
      .limit(20),
    supabase
      .from("phone_messages")
      .select(
        "id, thread_id, direction, from_number, to_number, body, status, created_at",
      )
      .eq("worker_id", workerId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("phone_voicemails")
      .select(
        "id, from_number, recording_url, duration_seconds, transcription, status, created_at",
      )
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    callLogs: callLogs ?? [],
    config: twilioConfigStatus(),
    messages: messages ?? [],
    settings,
    threads: threads ?? [],
    voicemails: voicemails ?? [],
  };
}
