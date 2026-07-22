import { requireProfile } from "@/features/auth/session";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getRecordingPlaybackUrl(recordingUrl: string) {
  return recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ voicemailId: string }> },
) {
  const profile = await requireProfile();
  const { voicemailId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: voicemail } = await supabase
    .from("phone_voicemails")
    .select("id, worker_id, recording_url")
    .eq("id", voicemailId)
    .maybeSingle();

  if (!voicemail?.recording_url) {
    return new Response("Recording not found.", { status: 404 });
  }

  if (profile.role === "worker" && voicemail.worker_id !== profile.id) {
    return new Response("Forbidden.", { status: 403 });
  }

  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return new Response("Twilio recording access is not configured.", { status: 500 });
  }

  const twilioResponse = await fetch(getRecordingPlaybackUrl(voicemail.recording_url), {
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.twilioAccountSid}:${env.twilioAuthToken}`,
      ).toString("base64")}`,
    },
  });

  if (!twilioResponse.ok || !twilioResponse.body) {
    return new Response("Recording could not be loaded.", {
      status: twilioResponse.status || 502,
    });
  }

  return new Response(twilioResponse.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": twilioResponse.headers.get("content-type") ?? "audio/mpeg",
    },
  });
}
