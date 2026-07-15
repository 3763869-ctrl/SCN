"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireAdminProfile, requireProfile } from "@/features/auth/session";
import {
  addDaysToDateKey,
  getEasternDateKey,
  getUtcDateFromEasternDateTime,
} from "@/lib/dates/eastern-time";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminConfig,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, PayrollSchedule } from "@/types/database";

function sanitizeStorageName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getOptionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value || null;
}

function getWorkerDetailsPayload(formData: FormData, workerId: string) {
  return {
    address_line1: getOptionalText(formData, "address_line1"),
    city: getOptionalText(formData, "city"),
    country: getOptionalText(formData, "country"),
    date_of_birth: getOptionalText(formData, "date_of_birth"),
    hiring_source: getOptionalText(formData, "hiring_source"),
    phone_number: getOptionalText(formData, "phone_number"),
    referral_name: getOptionalText(formData, "referral_name"),
    secondary_contact_name: getOptionalText(formData, "secondary_contact_name"),
    secondary_contact_phone: getOptionalText(formData, "secondary_contact_phone"),
    start_date: getOptionalText(formData, "start_date"),
    state: getOptionalText(formData, "state"),
    worker_id: workerId,
    zip_code: getOptionalText(formData, "zip_code"),
  };
}

function getWorkerOnboardingDetailsPayload(formData: FormData, workerId: string) {
  return {
    address_line1: getOptionalText(formData, "address_line1"),
    city: getOptionalText(formData, "city"),
    country: getOptionalText(formData, "country"),
    date_of_birth: getOptionalText(formData, "date_of_birth"),
    phone_number: getOptionalText(formData, "phone_number"),
    secondary_contact_name: getOptionalText(formData, "secondary_contact_name"),
    secondary_contact_phone: getOptionalText(formData, "secondary_contact_phone"),
    state: getOptionalText(formData, "state"),
    worker_id: workerId,
    zip_code: getOptionalText(formData, "zip_code"),
  };
}

export async function updateWorkerProfile(formData: FormData) {
  const admin = await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as AppRole;
  const active = formData.get("active") === "true";

  if (!id || !email || !["admin", "worker"].includes(role)) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  if (hasSupabaseAdminConfig()) {
    const adminSupabase = createSupabaseAdminClient();

    const { error } = await adminSupabase.auth.admin.updateUserById(id, {
      email,
      user_metadata: {
        full_name: fullName || email,
      },
    });

    if (error) {
      return;
    }
  }

  await supabase
    .from("profiles")
    .update({
      active,
      email,
      full_name: fullName || null,
      role,
    })
    .eq("id", id);
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "worker",
    eventType: "worker.profile.update",
    metadata: { active, email, role },
    summary: "Updated worker profile access settings",
  });

  revalidatePath("/workers");
}

export async function updateWorkerDetails(formData: FormData) {
  const admin = await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");

  if (!workerId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("worker_details").upsert(getWorkerDetailsPayload(formData, workerId));
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: workerId,
    entityType: "worker",
    eventType: "worker.details.update",
    summary: "Updated worker details",
  });

  revalidatePath("/workers");
}

export async function createWorkerOnboardingLink(formData: FormData) {
  const admin = await requireAdminProfile();
  const workerId = String(formData.get("worker_id") ?? "");

  if (!workerId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await supabase.from("worker_onboarding_links").insert({
    created_by: admin.id,
    expires_at: expiresAt.toISOString(),
    token,
    worker_id: workerId,
  });
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: workerId,
    entityType: "worker",
    eventType: "worker.onboarding_link.create",
    summary: "Created worker onboarding link",
  });

  revalidatePath("/workers");
}

export async function submitWorkerOnboarding(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  if (!token) {
    redirect("/login");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: link } = await adminSupabase
    .from("worker_onboarding_links")
    .select("id, worker_id, expires_at, completed_at")
    .eq("token", token)
    .maybeSingle();

  if (
    !link ||
    link.completed_at ||
    (link.expires_at && new Date(link.expires_at).getTime() < Date.now())
  ) {
    redirect(`/worker-onboarding/${token}?status=expired`);
  }

  await adminSupabase
    .from("worker_details")
    .upsert(getWorkerOnboardingDetailsPayload(formData, link.worker_id));
  await adminSupabase
    .from("worker_onboarding_links")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", link.id);

  redirect(`/worker-onboarding/${token}?status=complete`);
}

export async function markBirthdaySeen() {
  const profile = await requireProfile();
  const adminSupabase = createSupabaseAdminClient();
  const year = Number(getEasternDateKey().slice(0, 4));

  await adminSupabase
    .from("worker_details")
    .upsert({ birthday_last_shown_year: year, worker_id: profile.id });

  revalidatePath("/worker");
}

export async function archiveWorker(formData: FormData) {
  const admin = await requireAdminProfile();

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
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "worker",
    eventType: "worker.archive",
    summary: "Archived worker",
  });

  revalidatePath("/workers");
  revalidatePath("/time-tracking");
}

export async function deleteWorker(formData: FormData) {
  const admin = await requireAdminProfile();

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
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "worker",
    eventType: "worker.delete",
    summary: "Deleted worker and related auth account",
  });

  revalidatePath("/workers");
  revalidatePath("/time-tracking");
  revalidatePath("/payroll");
  revalidatePath("/worker");
}

export async function createWorker(formData: FormData) {
  const admin = await requireAdminProfile();

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

  await adminSupabase
    .from("worker_details")
    .upsert(getWorkerDetailsPayload(formData, data.user.id));
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: data.user.id,
    entityType: "worker",
    eventType: "worker.create",
    metadata: { email },
    summary: `Created worker ${fullName || email}`,
  });

  revalidatePath("/workers");
}

export async function updateWorkerPassword(formData: FormData) {
  const admin = await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!workerId || password.length < 6) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();

  await adminSupabase.auth.admin.updateUserById(workerId, {
    password,
  });
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: workerId,
    entityType: "worker",
    eventType: "worker.password.update",
    summary: "Updated worker password",
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
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: workerId,
    entityType: "worker_file",
    eventType: "worker_file.upload",
    metadata: { fileName: file.name },
    summary: "Uploaded worker file",
  });

  revalidatePath("/workers");
}

export async function updateWorkerFile(formData: FormData) {
  const admin = await requireAdminProfile();

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
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "worker_file",
    eventType: "worker_file.update",
    summary: "Updated worker file details",
  });

  revalidatePath("/workers");
}

export async function deleteWorkerFile(formData: FormData) {
  const admin = await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");

  if (!id || !storagePath) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.storage.from("worker-files").remove([storagePath]);
  await supabase.from("worker_files").delete().eq("id", id);
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "worker_file",
    eventType: "worker_file.delete",
    summary: "Deleted worker file",
  });

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

function redirectToTimeTracking(workerId: string, workDate: string, saved: string) {
  const params = new URLSearchParams({
    date: workDate,
    saved,
    week: getWeekStartKey(workDate),
    worker: workerId,
  });

  redirect(`/time-tracking?${params.toString()}`);
}

export async function updateWorkerTimesheetDay(formData: FormData) {
  await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const workDate = String(formData.get("work_date") ?? "");
  const timeEntryId = String(formData.get("time_entry_id") ?? "");
  const breakId = String(formData.get("break_id") ?? "");
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
    redirectToTimeTracking(workerId, workDate, "locked");
  }

  const { data: lockedUnitPeriod } = await supabase
    .from("production_unit_periods")
    .select("id")
    .eq("worker_id", workerId)
    .eq("status", "completed")
    .lte("period_start", workDate)
    .gte("period_end", workDate)
    .maybeSingle();

  const isUnitPeriodLocked = Boolean(lockedUnitPeriod);

  const { data: activeInvoiceLinks } = await supabase
    .from("production_unit_invoice_links")
    .select("id")
    .eq("worker_id", workerId)
    .eq("work_date", workDate)
    .is("released_at", null)
    .limit(1);
  const isUnitInvoiced = Boolean(activeInvoiceLinks?.length);

  if ((isUnitPeriodLocked || isUnitInvoiced) && action === "clear") {
    redirectToTimeTracking(
      workerId,
      workDate,
      isUnitInvoiced ? "units-invoiced" : "units-locked",
    );
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
    redirectToTimeTracking(workerId, workDate, "cleared");
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

  if (isUnitPeriodLocked || isUnitInvoiced) {
    revalidatePath("/time-tracking");
    revalidatePath("/worker");
    redirectToTimeTracking(
      workerId,
      workDate,
      isUnitInvoiced ? "units-invoiced" : "time-only",
    );
  }

  await supabase
    .from("production_units")
    .delete()
    .eq("worker_id", workerId)
    .eq("work_date", workDate);

  if (units > 0) {
    const unitPayload = {
      worker_id: workerId,
      quantity: Math.floor(units),
      work_date: workDate,
      status: "approved" as const,
      notes: "Admin adjusted timesheet",
    };

    await supabase.from("production_units").insert(unitPayload);
  }

  revalidatePath("/time-tracking");
  revalidatePath("/worker");
  redirectToTimeTracking(workerId, workDate, "saved");
}

export async function completeProductionUnitsPeriod(formData: FormData) {
  const admin = await requireAdminProfile();

  const workerId = String(formData.get("worker_id") ?? "");
  const periodStart = String(formData.get("period_start") ?? "");
  const requestedPeriodEnd = String(formData.get("period_end") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const lastLockableDate = addDaysToDateKey(getEasternDateKey(), -1);
  const periodEnd =
    requestedPeriodEnd && requestedPeriodEnd < lastLockableDate
      ? requestedPeriodEnd
      : lastLockableDate;

  if (!workerId || !periodStart || !requestedPeriodEnd || periodEnd < periodStart) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  await supabase
    .from("production_units")
    .update({ status: "approved" })
    .eq("worker_id", workerId)
    .gte("work_date", periodStart)
    .lte("work_date", periodEnd);

  await supabase.from("production_unit_periods").upsert(
    {
      completed_at: now,
      completed_by: admin.id,
      notes: notes || null,
      period_end: periodEnd,
      period_start: periodStart,
      reopened_at: null,
      reopened_by: null,
      status: "completed",
      worker_id: workerId,
    },
    { onConflict: "worker_id,period_start,period_end" },
  );

  revalidatePath("/time-tracking");
  revalidatePath("/invoices");
}

export async function reopenProductionUnitsPeriod(formData: FormData) {
  const admin = await requireAdminProfile();

  const periodId = String(formData.get("period_id") ?? "");

  if (!periodId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("production_unit_periods")
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: admin.id,
      status: "reopened",
    })
    .eq("id", periodId);

  revalidatePath("/time-tracking");
  revalidatePath("/invoices");
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
