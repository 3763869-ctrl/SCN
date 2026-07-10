import { createSupabaseServerClient } from "@/lib/supabase/server";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
});

export function getTodayBounds() {
  const now = new Date();
  const start = new Date(now);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    start,
    end,
    workDate: dayFormatter.format(now),
  };
}

export function getHoursBetween(start: string, end: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();

  return Math.max(0, (endMs - startMs) / 36e5);
}

export async function getWorkerDashboardData(workerId: string) {
  const supabase = await createSupabaseServerClient();
  const { start, end, workDate } = getTodayBounds();

  const [{ data: timeEntries }, { data: unitEntries }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at, notes")
      .eq("worker_id", workerId)
      .gte("clock_in_at", start.toISOString())
      .lt("clock_in_at", end.toISOString())
      .order("clock_in_at", { ascending: false }),
    supabase
      .from("production_units")
      .select("id, quantity, work_date, notes, status, created_at")
      .eq("worker_id", workerId)
      .eq("work_date", workDate)
      .order("created_at", { ascending: false }),
  ]);

  const entries = timeEntries ?? [];
  const units = unitEntries ?? [];
  const openEntry = entries.find((entry) => !entry.clock_out_at) ?? null;
  const todayHours = entries.reduce(
    (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
    0,
  );
  const todayUnits = units.reduce((total, entry) => total + entry.quantity, 0);

  return {
    openEntry,
    timeEntries: entries,
    unitEntries: units,
    todayHours,
    todayUnits,
    bonusProgress: Math.min(100, Math.round((todayUnits / 100) * 100)),
  };
}
