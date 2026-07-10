"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

type ProductionStatus = "pending" | "approved" | "rejected";

export async function updateWorkerProfile(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;
  const active = formData.get("active") === "true";

  if (!id || !["admin", "worker"].includes(role)) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("profiles").update({ role, active }).eq("id", id);

  revalidatePath("/workers");
}

export async function updateProductionStatus(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ProductionStatus;

  if (!id || !["pending", "approved", "rejected"].includes(status)) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("production_units").update({ status }).eq("id", id);

  revalidatePath("/production");
  revalidatePath("/workers");
}
