"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type VoicemailWorkflowState = {
  message: string;
  success: boolean;
};

function optionalUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  return text || null;
}

export async function updateVoicemailWorkflow(
  formData: FormData,
): Promise<VoicemailWorkflowState> {
  const profile = await requireProfile();
  const voicemailId = optionalUuid(formData.get("voicemail_id"));
  const assignedWorkerId = optionalUuid(formData.get("assigned_worker_id"));
  const isDone = formData.get("completed") === "on";

  if (!voicemailId) {
    return { message: "Voicemail was not found.", success: false };
  }

  const supabase = createSupabaseAdminClient();
  const { data: voicemail } = await supabase
    .from("phone_voicemails")
    .select("id, worker_id, assigned_worker_id")
    .eq("id", voicemailId)
    .maybeSingle();

  if (!voicemail) {
    return { message: "Voicemail was not found.", success: false };
  }

  const workerCanUpdate =
    profile.role === "worker" &&
    (voicemail.worker_id === profile.id ||
      voicemail.assigned_worker_id === profile.id ||
      !voicemail.assigned_worker_id);

  if (profile.role !== "admin" && !workerCanUpdate) {
    return { message: "You cannot update this voicemail.", success: false };
  }

  if (assignedWorkerId) {
    const { data: assignedWorker } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assignedWorkerId)
      .eq("role", "worker")
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (!assignedWorker) {
      return { message: "Choose an active worker.", success: false };
    }
  }

  const { error } = await supabase
    .from("phone_voicemails")
    .update({
      assigned_worker_id: assignedWorkerId,
      completed_at: isDone ? new Date().toISOString() : null,
      completed_by: isDone ? profile.id : null,
      status: isDone ? "done" : "received",
    })
    .eq("id", voicemailId);

  if (error) {
    if (
      error.message.includes("assigned_worker_id") ||
      error.message.includes("completed_at") ||
      error.message.includes("completed_by")
    ) {
      return {
        message: "Voicemail workflow is not installed yet. Run Supabase migration 0026.",
        success: false,
      };
    }

    return { message: "Voicemail could not be saved.", success: false };
  }

  revalidatePath("/worker");
  return { message: "Voicemail saved.", success: true };
}
