import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createVoiceResponse,
  getWorkerTwilioIdentity,
  validateTwilioRequest,
  twimlResponse,
} from "@/lib/twilio/server";
import {
  isWithinBusinessHours,
  normalizePhoneSystemSettings,
  usesBusinessHours,
} from "@/lib/twilio/phone-flow";

type WorkerPhoneSetting = {
  worker_id: string;
  extension: string | null;
  phone_enabled: boolean;
  calling_enabled: boolean;
  voicemail_greeting: string | null;
};

async function isWorkerClockedIn(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  workerId: string,
) {
  const { data: openEntry } = await adminSupabase
    .from("time_entries")
    .select("id")
    .eq("worker_id", workerId)
    .is("clock_out_at", null)
    .maybeSingle();

  return Boolean(openEntry);
}

async function getAvailableWorkerSettings(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  settings: WorkerPhoneSetting[],
  availabilityMode: "business_hours" | "worker_clock",
) {
  const enabledSettings = settings.filter(
    (setting) => setting.phone_enabled && setting.calling_enabled,
  );

  if (availabilityMode === "business_hours") {
    return enabledSettings;
  }

  const availability = await Promise.all(
    enabledSettings.map(async (setting) => ({
      setting,
      clockedIn: await isWorkerClockedIn(adminSupabase, setting.worker_id),
    })),
  );

  return availability
    .filter((entry) => entry.clockedIn)
    .map((entry) => entry.setting);
}

function sendToVoicemail({
  extension,
  greeting,
  origin,
  response,
}: {
  extension?: string;
  greeting: string;
  origin: string;
  response: ReturnType<typeof createVoiceResponse>;
}) {
  const extensionQuery = extension ? `?extension=${encodeURIComponent(extension)}` : "";

  response.say(greeting);
  response.record({
    action: `${origin}/api/twilio/voicemail${extensionQuery}`,
    maxLength: 120,
    recordingStatusCallback: `${origin}/api/twilio/voicemail${extensionQuery}`,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!(await validateTwilioRequest(request, formData))) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const digits = String(formData.get("Digits") ?? "").trim();
  const from = String(formData.get("From") ?? "");
  const callSid = String(formData.get("CallSid") ?? "");
  const response = createVoiceResponse();
  const adminSupabase = createSupabaseAdminClient();
  const { data: phoneSystemData } = await adminSupabase
    .from("phone_system_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const phoneSystem = normalizePhoneSystemSettings(phoneSystemData);

  if (usesBusinessHours(phoneSystem) && !isWithinBusinessHours(phoneSystem)) {
    sendToVoicemail({
      greeting: phoneSystem.after_hours_greeting,
      origin,
      response,
    });
    return twimlResponse(response.toString());
  }

  const { data: settings } = await adminSupabase
    .from("worker_phone_settings")
    .select("worker_id, extension, phone_enabled, calling_enabled, voicemail_greeting")
    .not("extension", "is", null);
  const matchingSettings = digits
    ? (settings ?? []).filter((setting) => setting.extension === digits)
    : (settings ?? []);
  const availableSettings = await getAvailableWorkerSettings(
    adminSupabase,
    matchingSettings,
    phoneSystem.availability_mode,
  );

  if (!availableSettings.length) {
    sendToVoicemail({
      extension: digits || undefined,
      greeting:
        phoneSystem.availability_mode === "worker_clock"
          ? phoneSystem.after_hours_greeting
          : phoneSystem.voicemail_greeting,
      origin,
      response,
    });
    return twimlResponse(response.toString());
  }

  response.say(phoneSystem.working_hours_greeting);

  await adminSupabase.from("phone_call_logs").insert(
    availableSettings.map((setting) => ({
      direction: "inbound",
      from_number: from || null,
      status: "ringing",
      to_number: digits || "main",
      twilio_call_sid: callSid || null,
      worker_id: setting.worker_id,
    })),
  );

  const dial = response.dial({
    action:
      availableSettings.length === 1
        ? `${origin}/api/twilio/voice/voicemail?workerId=${availableSettings[0].worker_id}`
        : `${origin}/api/twilio/voice/voicemail`,
    method: "POST",
    timeout: phoneSystem.ring_timeout_seconds,
  });
  availableSettings.forEach((setting) => {
    dial.client(getWorkerTwilioIdentity(setting.worker_id));
  });

  return twimlResponse(response.toString());
}
