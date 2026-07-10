"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, PayrollSchedule } from "@/types/database";

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

export async function updateWorkerPaySettings(formData: FormData) {
  await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const hourlyRate = Number(formData.get("hourly_rate"));
  const payrollSchedule = String(
    formData.get("payroll_schedule") ?? "weekly",
  ) as PayrollSchedule;
  const weeklyUnitGoal = Number(formData.get("weekly_unit_goal"));

  if (
    !workerId ||
    !Number.isFinite(hourlyRate) ||
    hourlyRate < 0 ||
    !["weekly", "semi_monthly"].includes(payrollSchedule) ||
    !Number.isFinite(weeklyUnitGoal) ||
    weeklyUnitGoal <= 0
  ) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("worker_pay_settings").upsert({
    worker_id: workerId,
    hourly_rate: hourlyRate,
    payroll_schedule: payrollSchedule,
    weekly_unit_goal: Math.floor(weeklyUnitGoal),
    active: true,
  });

  revalidatePath("/workers");
  revalidatePath("/worker");
}

export async function addBonusTier(formData: FormData) {
  await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "") || null;
  const thresholdUnits = Number(formData.get("threshold_units"));
  const bonusAmount = Number(formData.get("bonus_amount"));
  const label = String(formData.get("label") ?? "").trim();

  if (
    !Number.isFinite(thresholdUnits) ||
    thresholdUnits <= 0 ||
    !Number.isFinite(bonusAmount) ||
    bonusAmount < 0
  ) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("bonus_tiers").insert({
    worker_id: workerId,
    threshold_units: Math.floor(thresholdUnits),
    bonus_amount: bonusAmount,
    label: label || null,
    active: true,
  });

  revalidatePath("/workers");
  revalidatePath("/worker");
}

export async function updateBonusTier(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const workerId = String(formData.get("worker_id") ?? "") || null;
  const thresholdUnits = Number(formData.get("threshold_units"));
  const bonusAmount = Number(formData.get("bonus_amount"));
  const label = String(formData.get("label") ?? "").trim();
  const active = formData.get("active") === "true";

  if (
    !id ||
    !Number.isFinite(thresholdUnits) ||
    thresholdUnits <= 0 ||
    !Number.isFinite(bonusAmount) ||
    bonusAmount < 0
  ) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("bonus_tiers")
    .update({
      worker_id: workerId,
      threshold_units: Math.floor(thresholdUnits),
      bonus_amount: bonusAmount,
      label: label || null,
      active,
    })
    .eq("id", id);

  revalidatePath("/workers");
  revalidatePath("/worker");
}

export async function deleteBonusTier(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("bonus_tiers").delete().eq("id", id);

  revalidatePath("/workers");
  revalidatePath("/worker");
}
