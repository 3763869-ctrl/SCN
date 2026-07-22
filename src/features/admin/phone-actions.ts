"use server";

import { revalidatePath } from "next/cache";

import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value || null;
}

function requiredText(formData: FormData, name: string, fallback: string) {
  return optionalText(formData, name) ?? fallback;
}

function getBusinessDays(formData: FormData) {
  const days = formData
    .getAll("business_days")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

  return days.length ? days : [0, 1, 2, 3, 4, 5];
}

function getRingTimeout(formData: FormData) {
  const value = Number(formData.get("ring_timeout_seconds") ?? 60);

  if (!Number.isFinite(value)) {
    return 60;
  }

  return Math.min(120, Math.max(10, Math.round(value)));
}

export async function updatePhoneSystemSettings(formData: FormData) {
  const admin = await requireAdminProfile();
  const supabase = createSupabaseAdminClient();
  const settings = {
    active: formData.get("active") === "on",
    after_hours_greeting: requiredText(
      formData,
      "after_hours_greeting",
      "Thank you for calling S C N. We are currently closed. Please leave a message and we will call you back at the first opportunity.",
    ),
    business_days: getBusinessDays(formData),
    business_end_time: requiredText(formData, "business_end_time", "17:00"),
    business_start_time: requiredText(formData, "business_start_time", "09:00"),
    business_timezone: requiredText(formData, "business_timezone", "America/New_York"),
    id: true,
    ring_timeout_seconds: getRingTimeout(formData),
    voicemail_greeting: requiredText(
      formData,
      "voicemail_greeting",
      "No one is available right now. Please leave a message after the beep.",
    ),
    working_hours_greeting: requiredText(
      formData,
      "working_hours_greeting",
      "Thank you for calling S C N. Please enter the worker extension you are trying to reach.",
    ),
  };
  const { error } = await supabase
    .from("phone_system_settings")
    .upsert(settings, { onConflict: "id" });

  if (error) {
    throw new Error(`Could not save phone flow settings: ${error.message}`);
  }

  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: "phone-system",
    entityType: "phone_system_settings",
    eventType: "phone_system_settings.update",
    metadata: settings,
    summary: "Updated phone flow settings",
  });

  revalidatePath("/settings");
}

export async function updateWorkerPhoneSettings(formData: FormData) {
  const admin = await requireAdminProfile();
  const workerId = String(formData.get("worker_id") ?? "");
  const extension = optionalText(formData, "extension");

  if (!workerId) {
    return;
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("worker_phone_settings").upsert(
    {
      calling_enabled: formData.get("calling_enabled") === "on",
      extension,
      phone_enabled: formData.get("phone_enabled") === "on",
      texting_enabled: formData.get("texting_enabled") === "on",
      voicemail_greeting: optionalText(formData, "voicemail_greeting"),
      worker_id: workerId,
    },
    { onConflict: "worker_id" },
  );

  if (error) {
    throw new Error(`Could not save worker phone settings: ${error.message}`);
  }

  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: workerId,
    entityType: "worker_phone_settings",
    eventType: "worker_phone_settings.update",
    metadata: {
      callingEnabled: formData.get("calling_enabled") === "on",
      extension,
      phoneEnabled: formData.get("phone_enabled") === "on",
      textingEnabled: formData.get("texting_enabled") === "on",
    },
    summary: "Updated worker phone settings",
  });

  revalidatePath("/settings");
  revalidatePath("/worker");
}
