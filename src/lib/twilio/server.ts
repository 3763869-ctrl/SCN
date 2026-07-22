import twilio from "twilio";

import { env } from "@/lib/env";

export function hasTwilioVoiceConfig() {
  return Boolean(
    env.twilioAccountSid &&
      env.twilioAuthToken &&
      env.twilioApiKeySid &&
      env.twilioApiKeySecret &&
      env.twilioTwimlAppSid &&
      env.twilioPhoneNumber,
  );
}

export function hasTwilioMessagingConfig() {
  return Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioPhoneNumber);
}

export function getTwilioClient() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    throw new Error("Twilio REST credentials are not configured.");
  }

  return twilio(env.twilioAccountSid, env.twilioAuthToken);
}

export function getWorkerTwilioIdentity(workerId: string) {
  return `worker_${Buffer.from(workerId, "utf8").toString("base64url")}`;
}

export function getWorkerIdFromTwilioIdentity(identity: string | null | undefined) {
  const normalizedIdentity = identity?.replace(/^client:/, "");

  if (!normalizedIdentity?.startsWith("worker_")) {
    return null;
  }

  try {
    return Buffer.from(normalizedIdentity.slice("worker_".length), "base64url").toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

export function formatPhoneNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");

  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

export function createVoiceResponse() {
  return new twilio.twiml.VoiceResponse();
}

export function createMessagingResponse() {
  return new twilio.twiml.MessagingResponse();
}

export function twimlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export async function validateTwilioRequest(request: Request, formData: FormData) {
  if (!env.twilioAuthToken) {
    return false;
  }

  const signature = request.headers.get("x-twilio-signature");

  if (!signature) {
    return false;
  }

  const params: Record<string, string> = {};

  formData.forEach((value, key) => {
    if (typeof value === "string") {
      params[key] = value;
    }
  });

  return twilio.validateRequest(env.twilioAuthToken, signature, request.url, params);
}

export function twilioConfigStatus() {
  return {
    accountSid: Boolean(env.twilioAccountSid),
    apiKeySecret: Boolean(env.twilioApiKeySecret),
    apiKeySid: Boolean(env.twilioApiKeySid),
    authToken: Boolean(env.twilioAuthToken),
    phoneNumber: Boolean(env.twilioPhoneNumber),
    twimlAppSid: Boolean(env.twilioTwimlAppSid),
    voiceReady: hasTwilioVoiceConfig(),
    messagingReady: hasTwilioMessagingConfig(),
    webhookSecret: Boolean(env.twilioWebhookSecret),
  };
}
