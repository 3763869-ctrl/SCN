import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId");
  const extension = url.searchParams.get("extension");
  const recordingUrl = String(formData.get("RecordingUrl") ?? "");
  const recordingSid = String(formData.get("RecordingSid") ?? "");
  const callSid = String(formData.get("CallSid") ?? "");
  const from = String(formData.get("From") ?? "");
  const duration = Number(formData.get("RecordingDuration") ?? 0);
  const adminSupabase = createSupabaseAdminClient();
  let resolvedWorkerId = workerId;

  if (!resolvedWorkerId && extension) {
    const { data: setting } = await adminSupabase
      .from("worker_phone_settings")
      .select("worker_id")
      .eq("extension", extension)
      .maybeSingle();
    resolvedWorkerId = setting?.worker_id ?? null;
  }

  const { data: callLog } = callSid
    ? await adminSupabase
        .from("phone_call_logs")
        .select("id, worker_id")
        .eq("twilio_call_sid", callSid)
        .maybeSingle()
    : { data: null };

  await adminSupabase.from("phone_voicemails").upsert(
    {
      call_log_id: callLog?.id ?? null,
      duration_seconds: Number.isFinite(duration) ? duration : null,
      from_number: from || null,
      recording_sid: recordingSid || null,
      recording_url: recordingUrl || null,
      status: "received",
      worker_id: resolvedWorkerId ?? callLog?.worker_id ?? null,
    },
    { onConflict: "recording_sid" },
  );

  if (callLog?.id) {
    await adminSupabase
      .from("phone_call_logs")
      .update({ status: "voicemail" })
      .eq("id", callLog.id);
  }

  return new Response("OK");
}
