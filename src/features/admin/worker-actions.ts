"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, PayrollSchedule } from "@/types/database";

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

function buildDateTime(workDate: string, value: FormDataEntryValue | null) {
  const timeValue = String(value ?? "").trim();

  if (!timeValue) {
    return null;
  }

  return new Date(`${workDate}T${timeValue}:00`).toISOString();
}

function getWeekStartKey(workDate: string) {
  const date = new Date(`${workDate}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());

  return new Intl.DateTimeFormat("en-CA").format(date);
}

export async function updateWorkerTimesheetDay(formData: FormData) {
  await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const workDate = String(formData.get("work_date") ?? "");
  const timeEntryId = String(formData.get("time_entry_id") ?? "");
  const breakId = String(formData.get("break_id") ?? "");
  const unitEntryId = String(formData.get("unit_entry_id") ?? "");
  const action = String(formData.get("action") ?? "save");
  const clockInAt = buildDateTime(workDate, formData.get("clock_in"));
  const clockOutAt = buildDateTime(workDate, formData.get("clock_out"));
  const lunchMinutes = Number(formData.get("lunch_minutes") ?? 0);
  const units = Number(formData.get("units") ?? 0);

  if (
    !workerId ||
    !workDate ||
    !Number.isFinite(lunchMinutes) ||
    lunchMinutes < 0 ||
    !Number.isFinite(units) ||
    units < 0
  ) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  let targetTimeEntryId = timeEntryId;

  const { data: timesheetWeek } = await supabase
    .from("timesheet_weeks")
    .select("status")
    .eq("worker_id", workerId)
    .eq("week_start", getWeekStartKey(workDate))
    .maybeSingle();

  if (timesheetWeek?.status === "completed") {
    return;
  }

  if (action === "clear") {
    const dayStart = new Date(`${workDate}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const { data: entriesToClear } = await supabase
      .from("time_entries")
      .select("id")
      .eq("worker_id", workerId)
      .gte("clock_in_at", dayStart.toISOString())
      .lt("clock_in_at", dayEnd.toISOString());

    const entryIds = (entriesToClear ?? []).map((entry) => entry.id);

    await supabase
      .from("time_breaks")
      .delete()
      .eq("worker_id", workerId)
      .gte("break_start_at", dayStart.toISOString())
      .lt("break_start_at", dayEnd.toISOString());

    if (entryIds.length) {
      await supabase.from("time_entries").delete().in("id", entryIds);
    }

    await supabase
      .from("production_units")
      .delete()
      .eq("worker_id", workerId)
      .eq("work_date", workDate);

    revalidatePath("/time-tracking");
    revalidatePath("/worker");
    return;
  }

  if (targetTimeEntryId && !clockInAt && !clockOutAt && lunchMinutes === 0) {
    await supabase.from("time_breaks").delete().eq("time_entry_id", targetTimeEntryId);
    await supabase.from("time_entries").delete().eq("id", targetTimeEntryId);
    targetTimeEntryId = "";
  }

  if (clockInAt || clockOutAt || lunchMinutes > 0) {
    const timePayload = {
      worker_id: workerId,
      clock_in_at: clockInAt ?? new Date(`${workDate}T00:00:00`).toISOString(),
      clock_out_at: clockOutAt,
      notes: "Admin adjusted timesheet",
    };

    if (targetTimeEntryId) {
      await supabase
        .from("time_entries")
        .update(timePayload)
        .eq("id", targetTimeEntryId);
    } else {
      const { data } = await supabase
        .from("time_entries")
        .insert(timePayload)
        .select("id")
        .single();

      targetTimeEntryId = data?.id ?? "";
    }
  }

  if (targetTimeEntryId) {
    if (lunchMinutes > 0) {
      const breakStart = clockInAt
        ? new Date(new Date(clockInAt).getTime() + 4 * 60 * 60 * 1000)
        : new Date(`${workDate}T12:00:00`);
      const breakEnd = new Date(breakStart.getTime() + lunchMinutes * 60 * 1000);
      const breakPayload = {
        worker_id: workerId,
        time_entry_id: targetTimeEntryId,
        break_start_at: breakStart.toISOString(),
        break_end_at: breakEnd.toISOString(),
        break_type: "lunch",
      };

      if (breakId) {
        await supabase.from("time_breaks").update(breakPayload).eq("id", breakId);
      } else {
        await supabase.from("time_breaks").insert(breakPayload);
      }
    } else if (breakId) {
      await supabase.from("time_breaks").delete().eq("id", breakId);
    }
  }

  if (units > 0) {
    const unitPayload = {
      worker_id: workerId,
      quantity: Math.floor(units),
      work_date: workDate,
      status: "approved" as const,
      notes: "Admin adjusted timesheet",
    };

    if (unitEntryId) {
      await supabase
        .from("production_units")
        .update(unitPayload)
        .eq("id", unitEntryId);
    } else {
      await supabase.from("production_units").insert(unitPayload);
    }
  } else if (unitEntryId) {
    await supabase.from("production_units").delete().eq("id", unitEntryId);
  }

  revalidatePath("/time-tracking");
  revalidatePath("/worker");
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
