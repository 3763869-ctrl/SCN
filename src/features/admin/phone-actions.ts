"use server";

import { revalidatePath } from "next/cache";

import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value || null;
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
