"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/features/auth/session";
import { getBreakHours, getHoursBetween } from "@/features/worker/metrics";
import {
  addDaysToDateKey,
  getUtcDateFromEasternDateTime,
} from "@/lib/dates/eastern-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkerPayrollStatus } from "@/types/database";

function getWeekDates(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const weekStartKey = addDaysToDateKey(value, -date.getUTCDay());
  const weekEndKey = addDaysToDateKey(weekStartKey, 5);
  const weekQueryEndKey = addDaysToDateKey(weekStartKey, 7);

  return {
    dueDateKey: addDaysToDateKey(weekStartKey, 12),
    weekEndKey,
    weekQueryEnd: getUtcDateFromEasternDateTime(weekQueryEndKey),
    weekQueryEndKey,
    weekStart: getUtcDateFromEasternDateTime(weekStartKey),
    weekStartKey,
  };
}

function getPayrollStatus(totalOwed: number, totalPaid: number): WorkerPayrollStatus {
  if (totalPaid >= totalOwed && totalOwed > 0) {
    return "paid";
  }

  if (totalPaid > 0) {
    return "partial";
  }

  return "due";
}

async function calculateWeeklyPayroll(workerId: string, weekStartValue: string) {
  const supabase = await createSupabaseServerClient();
  const {
    dueDateKey,
    weekEndKey,
    weekQueryEnd,
    weekQueryEndKey,
    weekStart,
    weekStartKey,
  } = getWeekDates(weekStartValue);

  const [
    { data: timeEntries },
    { data: breaks },
    { data: units },
    { data: paySettings },
    { data: bonusTiers },
  ] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at")
      .eq("worker_id", workerId)
      .gte("clock_in_at", weekStart.toISOString())
      .lt("clock_in_at", weekQueryEnd.toISOString()),
    supabase
      .from("time_breaks")
      .select("id, break_start_at, break_end_at")
      .eq("worker_id", workerId)
      .gte("break_start_at", weekStart.toISOString())
      .lt("break_start_at", weekQueryEnd.toISOString()),
    supabase
      .from("production_units")
      .select("id, quantity, work_date")
      .eq("worker_id", workerId)
      .gte("work_date", weekStartKey)
      .lt("work_date", weekQueryEndKey),
    supabase
      .from("worker_pay_settings")
      .select("hourly_rate")
      .eq("worker_id", workerId)
      .maybeSingle(),
    supabase
      .from("bonus_tiers")
      .select("id, worker_id, threshold_units, bonus_amount, active")
      .or(`worker_id.is.null,worker_id.eq.${workerId}`)
      .eq("active", true),
  ]);

  const grossHours = (timeEntries ?? []).reduce(
    (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
    0,
  );
  const totalHours = Math.round(
    Math.max(0, grossHours - getBreakHours(breaks ?? [])) * 100,
  ) / 100;
  const totalUnits = (units ?? []).reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  const hourlyRate = Number(paySettings?.hourly_rate ?? 0);
  const hourlyPay = Math.round(totalHours * hourlyRate * 100) / 100;
  const bonusPay = (bonusTiers ?? [])
    .filter((tier) => totalUnits >= tier.threshold_units)
    .reduce((total, tier) => total + Number(tier.bonus_amount), 0);
  const totalOwed = Math.round((hourlyPay + bonusPay) * 100) / 100;

  return {
    bonusPay,
    dueDate: dueDateKey,
    hourlyPay,
    hourlyRate,
    totalHours,
    totalOwed,
    totalUnits,
    weekEnd: weekEndKey,
    weekStart: weekStartKey,
  };
}

export async function completeTimesheetWeek(formData: FormData) {
  const admin = await requireAdminProfile();
  const workerId = String(formData.get("worker_id") ?? "");
  const weekStartValue = String(formData.get("week_start") ?? "");

  if (!workerId || !weekStartValue) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const totals = await calculateWeeklyPayroll(workerId, weekStartValue);
  const now = new Date().toISOString();

  const { data: timesheetWeek } = await supabase
    .from("timesheet_weeks")
    .upsert(
      {
        completed_at: now,
        completed_by: admin.id,
        reopened_at: null,
        reopened_by: null,
        status: "completed",
        week_end: totals.weekEnd,
        week_start: totals.weekStart,
        worker_id: workerId,
      },
      { onConflict: "worker_id,week_start" },
    )
    .select("id")
    .single();

  if (!timesheetWeek) {
    return;
  }

  const { data: existingPayroll } = await supabase
    .from("worker_payrolls")
    .select("id, total_paid")
    .eq("worker_id", workerId)
    .eq("week_start", totals.weekStart)
    .maybeSingle();
  const totalPaid = Number(existingPayroll?.total_paid ?? 0);
  const balanceRemaining = Math.max(0, totals.totalOwed - totalPaid);

  await supabase.from("worker_payrolls").upsert(
    {
      balance_remaining: balanceRemaining,
      bonus_pay: totals.bonusPay,
      due_date: totals.dueDate,
      hourly_pay: totals.hourlyPay,
      hourly_rate: totals.hourlyRate,
      status: getPayrollStatus(totals.totalOwed, totalPaid),
      timesheet_week_id: timesheetWeek.id,
      total_hours: totals.totalHours,
      total_owed: totals.totalOwed,
      total_paid: totalPaid,
      total_units: totals.totalUnits,
      week_end: totals.weekEnd,
      week_start: totals.weekStart,
      worker_id: workerId,
    },
    { onConflict: "worker_id,week_start" },
  );

  revalidatePath("/time-tracking");
  revalidatePath("/payroll");
}

export async function reopenTimesheetWeek(formData: FormData) {
  const admin = await requireAdminProfile();
  const timesheetWeekId = String(formData.get("timesheet_week_id") ?? "");
  const payrollId = String(formData.get("payroll_id") ?? "");

  if (!timesheetWeekId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("timesheet_weeks")
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: admin.id,
      status: "reopened",
    })
    .eq("id", timesheetWeekId);

  if (payrollId) {
    await supabase
      .from("worker_payrolls")
      .update({ status: "reopened" })
      .eq("id", payrollId);
  }

  revalidatePath("/time-tracking");
  revalidatePath("/payroll");
}

export async function recordPayrollPayment(formData: FormData) {
  const admin = await requireAdminProfile();
  const payrollId = String(formData.get("payroll_id") ?? "");
  const workerId = String(formData.get("worker_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paidAt = String(formData.get("paid_at") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!payrollId || !workerId || !Number.isFinite(amount) || amount <= 0 || !paidAt) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("payroll_payments").insert({
    amount,
    created_by: admin.id,
    notes: notes || null,
    paid_at: paidAt,
    payroll_id: payrollId,
    worker_id: workerId,
  });

  const [{ data: payroll }, { data: payments }] = await Promise.all([
    supabase
      .from("worker_payrolls")
      .select("total_owed")
      .eq("id", payrollId)
      .single(),
    supabase
      .from("payroll_payments")
      .select("amount")
      .eq("payroll_id", payrollId),
  ]);

  const totalOwed = Number(payroll?.total_owed ?? 0);
  const totalPaid = (payments ?? []).reduce(
    (total, payment) => total + Number(payment.amount),
    0,
  );

  await supabase
    .from("worker_payrolls")
    .update({
      balance_remaining: Math.max(0, totalOwed - totalPaid),
      status: getPayrollStatus(totalOwed, totalPaid),
      total_paid: totalPaid,
    })
    .eq("id", payrollId);

  revalidatePath("/payroll");
  revalidatePath("/time-tracking");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}
