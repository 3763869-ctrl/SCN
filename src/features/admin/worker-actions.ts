"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/features/auth/session";
import {
  addDaysToDateKey,
  getUtcDateFromEasternDateTime,
} from "@/lib/dates/eastern-time";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, PayrollSchedule } from "@/types/database";

function sanitizeStorageName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

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

export async function archiveWorker(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("profiles")
    .update({ active: false })
    .eq("id", id)
    .eq("role", "worker");

  revalidatePath("/workers");
  revalidatePath("/time-tracking");
}

export async function deleteWorker(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: files } = await adminSupabase
    .from("worker_files")
    .select("storage_path")
    .eq("worker_id", id);
  const storagePaths = (files ?? [])
    .map((file) => file.storage_path)
    .filter(Boolean);

  if (storagePaths.length) {
    await adminSupabase.storage.from("worker-files").remove(storagePaths);
  }

  await adminSupabase.auth.admin.deleteUser(id);
  await adminSupabase.from("profiles").delete().eq("id", id).eq("role", "worker");

  revalidatePath("/workers");
  revalidatePath("/time-tracking");
  revalidatePath("/payroll");
  revalidatePath("/worker");
}

export async function createWorker(formData: FormData) {
  await requireAdminProfile();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const active = formData.get("active") !== "false";

  if (!email || password.length < 6) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: fullName || email,
    },
  });

  if (error || !data.user) {
    return;
  }

  await adminSupabase.from("profiles").upsert({
    active,
    email,
    full_name: fullName || null,
    id: data.user.id,
    role: "worker",
  });

  await adminSupabase.from("worker_pay_settings").upsert({
    active: true,
    hourly_rate: 0,
    payroll_schedule: "weekly",
    weekly_unit_goal: 100,
    worker_id: data.user.id,
  });

  revalidatePath("/workers");
}

export async function updateWorkerPassword(formData: FormData) {
  await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!workerId || password.length < 6) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();

  await adminSupabase.auth.admin.updateUserById(workerId, {
    password,
  });

  revalidatePath("/workers");
}

export async function uploadWorkerFile(formData: FormData) {
  const admin = await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const documentType = String(formData.get("document_type") ?? "").trim();
  const signed = formData.get("signed") === "true";
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("file");

  if (!workerId || !(file instanceof File) || file.size === 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const safeName = sanitizeStorageName(file.name);
  const storagePath = `${workerId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("worker-files")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return;
  }

  await supabase.from("worker_files").insert({
    document_type: documentType || null,
    file_name: file.name,
    notes: notes || null,
    signed,
    storage_path: storagePath,
    uploaded_by: admin.id,
    worker_id: workerId,
  });

  revalidatePath("/workers");
}

export async function updateWorkerFile(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const documentType = String(formData.get("document_type") ?? "").trim();
  const signed = formData.get("signed") === "true";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("worker_files")
    .update({
      document_type: documentType || null,
      notes: notes || null,
      signed,
    })
    .eq("id", id);

  revalidatePath("/workers");
}

export async function deleteWorkerFile(formData: FormData) {
  await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");

  if (!id || !storagePath) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.storage.from("worker-files").remove([storagePath]);
  await supabase.from("worker_files").delete().eq("id", id);

  revalidatePath("/workers");
}

function buildDateTime(workDate: string, value: FormDataEntryValue | null) {
  const timeValue = String(value ?? "").trim();

  if (!timeValue) {
    return null;
  }

  return getUtcDateFromEasternDateTime(workDate, `${timeValue}:00`).toISOString();
}

function getWeekStartKey(workDate: string) {
  const date = new Date(`${workDate}T00:00:00Z`);

  return addDaysToDateKey(workDate, -date.getUTCDay());
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
    const dayStart = getUtcDateFromEasternDateTime(workDate);
    const dayEnd = getUtcDateFromEasternDateTime(addDaysToDateKey(workDate, 1));

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
      clock_in_at:
        clockInAt ?? getUtcDateFromEasternDateTime(workDate).toISOString(),
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
        : getUtcDateFromEasternDateTime(workDate, "12:00:00");
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
