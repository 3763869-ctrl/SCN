import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addDaysToDateKey,
  getEasternDateKey,
  getEasternDayBounds,
  getEasternWeekBounds,
  getUtcDateFromEasternDateTime,
} from "@/lib/dates/eastern-time";

const weekDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

export function getTodayBounds() {
  return getEasternDayBounds();
}

export function getWeekBounds() {
  return getEasternWeekBounds();
}

export function getPayrollPeriodBounds(schedule: "weekly" | "semi_monthly") {
  const now = new Date();

  if (schedule === "weekly") {
    return getWeekBounds();
  }

  const todayKey = getEasternDateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const startKey = `${year}-${String(month).padStart(2, "0")}-${
    day <= 15 ? "01" : "16"
  }`;
  const endKey =
    day <= 15
      ? `${year}-${String(month).padStart(2, "0")}-16`
      : new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

  return {
    end: getUtcDateFromEasternDateTime(endKey),
    start: getUtcDateFromEasternDateTime(startKey),
  };
}

export function getHoursBetween(start: string, end: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();

  return Math.max(0, (endMs - startMs) / 36e5);
}

export function getBreakHours(
  breaks: Array<{ break_start_at: string; break_end_at: string | null }>,
) {
  return breaks.reduce(
    (total, entry) => total + getHoursBetween(entry.break_start_at, entry.break_end_at),
    0,
  );
}

export async function getWorkerDashboardData(workerId: string) {
  const supabase = await createSupabaseServerClient();
  const { start, end, workDate } = getTodayBounds();
  const week = getWeekBounds();

  const [
    { data: activeOpenEntry },
    { data: activeOpenBreak },
    { data: timeEntries },
    { data: breaks },
    { data: unitEntries },
    { data: weekTimeEntries },
    { data: weekBreaks },
    { data: weekUnitEntries },
    { data: paySettings },
    { data: bonusTiers },
    { data: pushSubscriptions },
    { data: presenceChecks },
  ] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at")
      .eq("worker_id", workerId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("time_breaks")
      .select("id, break_start_at, break_end_at, break_type")
      .eq("worker_id", workerId)
      .is("break_end_at", null)
      .order("break_start_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at, notes")
      .eq("worker_id", workerId)
      .gte("clock_in_at", start.toISOString())
      .lt("clock_in_at", end.toISOString())
      .order("clock_in_at", { ascending: false }),
    supabase
      .from("time_breaks")
      .select("id, time_entry_id, break_start_at, break_end_at, break_type")
      .eq("worker_id", workerId)
      .gte("break_start_at", start.toISOString())
      .lt("break_start_at", end.toISOString())
      .order("break_start_at", { ascending: false }),
    supabase
      .from("production_units")
      .select("id, quantity, work_date, notes, status, created_at")
      .eq("worker_id", workerId)
      .eq("work_date", workDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at, notes")
      .eq("worker_id", workerId)
      .gte("clock_in_at", week.start.toISOString())
      .lt("clock_in_at", week.end.toISOString())
      .order("clock_in_at", { ascending: true }),
    supabase
      .from("time_breaks")
      .select("id, time_entry_id, break_start_at, break_end_at")
      .eq("worker_id", workerId)
      .gte("break_start_at", week.start.toISOString())
      .lt("break_start_at", week.end.toISOString())
      .order("break_start_at", { ascending: true }),
    supabase
      .from("production_units")
      .select("id, quantity, work_date, status, created_at")
      .eq("worker_id", workerId)
      .gte("work_date", week.weekStartKey)
      .lt("work_date", addDaysToDateKey(week.weekStartKey, 7))
      .order("work_date", { ascending: true }),
    supabase
      .from("worker_pay_settings")
      .select("hourly_rate, payroll_schedule, weekly_unit_goal")
      .eq("worker_id", workerId)
      .maybeSingle(),
    supabase
      .from("bonus_tiers")
      .select("id, threshold_units, bonus_amount, label")
      .or(`worker_id.is.null,worker_id.eq.${workerId}`)
      .eq("active", true)
      .order("threshold_units", { ascending: true }),
    supabase
      .from("worker_push_subscriptions")
      .select("id")
      .eq("worker_id", workerId)
      .eq("active", true)
      .limit(1),
    supabase
      .from("worker_presence_checks")
      .select("id, status, scheduled_at, sent_at, expires_at, responded_at, auto_clock_out_at")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const entries = timeEntries ?? [];
  const breakEntries = breaks ?? [];
  const units = unitEntries ?? [];
  const openEntry = activeOpenEntry ?? null;
  const openBreak = activeOpenBreak ?? null;
  const closedTodayHours = entries.reduce(
    (total, entry) =>
      entry.clock_out_at
        ? total + getHoursBetween(entry.clock_in_at, entry.clock_out_at)
        : total,
    0,
  );
  const closedTodayBreakHours = breakEntries.reduce(
    (total, entry) =>
      entry.break_end_at
        ? total + getHoursBetween(entry.break_start_at, entry.break_end_at)
        : total,
    0,
  );
  const todayBreakHours = getBreakHours(breakEntries);
  const todayHours = Math.max(0, closedTodayHours - closedTodayBreakHours);
  const todayUnits = units.reduce((total, entry) => total + entry.quantity, 0);
  const weekEntries = weekTimeEntries ?? [];
  const weekBreakEntries = weekBreaks ?? [];
  const weekUnits = weekUnitEntries ?? [];
  const grossWeekHours = weekEntries.reduce(
    (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
    0,
  );
  const weekHours = Math.max(0, grossWeekHours - getBreakHours(weekBreakEntries));
  const weekUnitTotal = weekUnits.reduce((total, entry) => total + entry.quantity, 0);
  const settings = paySettings ?? {
    hourly_rate: 0,
    payroll_schedule: "weekly" as const,
    weekly_unit_goal: 100,
  };
  const payrollPeriod = getPayrollPeriodBounds(settings.payroll_schedule);
  const payrollHours = weekHours;
  const tiers = bonusTiers ?? [];
  const earnedBonuses = tiers.filter((tier) => weekUnitTotal >= tier.threshold_units);
  const hourlyPayEstimate = payrollHours * Number(settings.hourly_rate);
  const bonusPayEstimate = earnedBonuses.reduce(
    (total, tier) => total + Number(tier.bonus_amount),
    0,
  );
  const payrollEstimate = hourlyPayEstimate + bonusPayEstimate;
  const nextBonus =
    tiers.find((tier) => weekUnitTotal < tier.threshold_units) ?? null;
  const calendarDays = Array.from({ length: 6 }, (_, index) => {
    const dayKey = addDaysToDateKey(week.weekStartKey, index);
    const dayTimeEntries = weekEntries.filter((entry) => {
      return getEasternDateKey(new Date(entry.clock_in_at)) === dayKey;
    });
    const dayBreakEntries = weekBreakEntries.filter((entry) => {
      return getEasternDateKey(new Date(entry.break_start_at)) === dayKey;
    });
    const hours = Math.max(
      0,
      dayTimeEntries.reduce(
        (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
        0,
      ) - getBreakHours(dayBreakEntries),
    );
    const unitTotal = weekUnits
      .filter((entry) => entry.work_date === dayKey)
      .reduce((total, entry) => total + entry.quantity, 0);

    return {
      date: dayKey,
      dayLabel: weekDayFormatter.format(new Date(`${dayKey}T00:00:00Z`)),
      hours,
      units: unitTotal,
    };
  });

  return {
    openEntry,
    openBreak,
    breakEntries,
    timeEntries: entries,
    unitEntries: units,
    todayHours,
    todayBreakHours,
    todayUnits,
    weekHours,
    weekUnits: weekUnitTotal,
    weeklyUnitGoal: settings.weekly_unit_goal,
    bonusProgress: Math.min(
      100,
      Math.round((weekUnitTotal / Math.max(1, settings.weekly_unit_goal)) * 100),
    ),
    bonusTiers: tiers,
    earnedBonuses,
    nextBonus,
    payrollSchedule: settings.payroll_schedule,
    hourlyRate: Number(settings.hourly_rate),
    hourlyPayEstimate,
    bonusPayEstimate,
    payrollEstimate,
    payrollPeriod: {
      start: getEasternDateKey(payrollPeriod.start),
      end: getEasternDateKey(payrollPeriod.end),
    },
    calendarDays,
    pushSubscriptionActive: Boolean(pushSubscriptions?.length),
    recentPresenceChecks: presenceChecks ?? [],
  };
}
