import { createSupabaseServerClient } from "@/lib/supabase/server";

const weekDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
});

function getStartOfDay(date: Date) {
  const start = new Date(date);

  start.setHours(0, 0, 0, 0);

  return start;
}

export function getTodayBounds() {
  const now = new Date();
  const start = getStartOfDay(now);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    start,
    end,
    workDate: dayFormatter.format(now),
  };
}

export function getWeekBounds() {
  const now = new Date();
  const start = getStartOfDay(now);
  const day = start.getDay();

  start.setDate(start.getDate() - day);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

export function getPayrollPeriodBounds(schedule: "weekly" | "semi_monthly") {
  const now = new Date();

  if (schedule === "weekly") {
    return getWeekBounds();
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() <= 15 ? 1 : 16);

  const end = new Date(start);
  if (start.getDate() === 1) {
    end.setDate(16);
  } else {
    end.setMonth(end.getMonth() + 1, 1);
  }

  return { start, end };
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
      .select("id, break_start_at, break_end_at")
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
      .gte("work_date", dayFormatter.format(week.start))
      .lt("work_date", dayFormatter.format(week.end))
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
  const calendarDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week.start);
    date.setDate(week.start.getDate() + index);
    const dayStart = getStartOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const dayKey = dayFormatter.format(date);
    const dayTimeEntries = weekEntries.filter((entry) => {
      const value = new Date(entry.clock_in_at);
      return value >= dayStart && value < dayEnd;
    });
    const dayBreakEntries = weekBreakEntries.filter((entry) => {
      const value = new Date(entry.break_start_at);
      return value >= dayStart && value < dayEnd;
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
      dayLabel: weekDayFormatter.format(date),
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
      start: dayFormatter.format(payrollPeriod.start),
      end: dayFormatter.format(payrollPeriod.end),
    },
    calendarDays,
  };
}
