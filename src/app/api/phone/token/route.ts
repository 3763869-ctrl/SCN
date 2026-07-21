import { NextResponse } from "next/server";
import twilio from "twilio";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWorkerTwilioIdentity,
  hasTwilioVoiceConfig,
} from "@/lib/twilio/server";
import { env } from "@/lib/env";

export async function GET() {
  const profile = await requireProfile();

  if (profile.role !== "worker") {
    return NextResponse.json({ error: "Worker access required." }, { status: 403 });
  }

  if (!hasTwilioVoiceConfig()) {
    return NextResponse.json(
      { error: "Twilio Voice is not configured." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("worker_phone_settings")
    .select("phone_enabled, calling_enabled")
    .eq("worker_id", profile.id)
    .maybeSingle();

  if (!settings?.phone_enabled || !settings.calling_enabled) {
    return NextResponse.json(
      { error: "Phone calling is not enabled for this worker." },
      { status: 403 },
    );
  }

  const identity = getWorkerTwilioIdentity(profile.id);
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(
    env.twilioAccountSid,
    env.twilioApiKeySid,
    env.twilioApiKeySecret,
    {
      identity,
      ttl: 3600,
    },
  );

  token.addGrant(
    new VoiceGrant({
      incomingAllow: true,
      outgoingApplicationSid: env.twilioTwimlAppSid,
    }),
  );

  return NextResponse.json({
    identity,
    token: token.toJwt(),
  });
}
