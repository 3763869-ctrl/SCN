import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getProfileLabel } from "@/features/admin/data";
import { updateWorkerTimesheetDay } from "@/features/admin/worker-actions";
import { getBreakHours, getHoursBetween } from "@/features/worker/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const dayFormatter = new Intl.DateTimeFormat("en-CA");
const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});
const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

function getStartOfWeek(value?: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());

  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);

  return next;
}

function getDateKey(date: Date) {
  return dayFormatter.format(date);
}

function getTimeValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toTimeString().slice(0, 5);
}

function getWeekLink(workerId: string, weekStart: Date, offsetDays: number) {
  const target = addDays(weekStart, offsetDays);

  return `/time-tracking?worker=${workerId}&week=${getDateKey(target)}`;
}

type TimeTrackingPageProps = {
  searchParams?: Promise<{ week?: string; worker?: string }>;
};

export default async function TimeTrackingPage({
  searchParams,
}: TimeTrackingPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const weekStart = getStartOfWeek(params?.week);
  const weekEnd = addDays(weekStart, 7);
  const workDays = Array.from({ length: 6 }, (_, index) =>
    addDays(weekStart, index),
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .eq("role", "worker")
    .order("full_name", { ascending: true });

  const workers = profiles ?? [];
  const selectedWorker =
    workers.find((worker) => worker.id === params?.worker) ?? workers[0] ?? null;

  const [
    { data: timeEntries },
    { data: breaks },
    { data: units },
    { data: paySettings },
    { data: bonusTiers },
  ] = selectedWorker
    ? await Promise.all([
        supabase
          .from("time_entries")
          .select("id, worker_id, clock_in_at, clock_out_at, notes")
          .eq("worker_id", selectedWorker.id)
          .gte("clock_in_at", weekStart.toISOString())
          .lt("clock_in_at", weekEnd.toISOString())
          .order("clock_in_at", { ascending: true }),
        supabase
          .from("time_breaks")
          .select("id, time_entry_id, worker_id, break_start_at, break_end_at")
          .eq("worker_id", selectedWorker.id)
          .gte("break_start_at", weekStart.toISOString())
          .lt("break_start_at", weekEnd.toISOString())
          .order("break_start_at", { ascending: true }),
        supabase
          .from("production_units")
          .select("id, worker_id, quantity, work_date, status")
          .eq("worker_id", selectedWorker.id)
          .gte("work_date", getDateKey(weekStart))
          .lt("work_date", getDateKey(weekEnd))
          .order("work_date", { ascending: true }),
        supabase
          .from("worker_pay_settings")
          .select("hourly_rate, weekly_unit_goal")
          .eq("worker_id", selectedWorker.id)
          .maybeSingle(),
        supabase
          .from("bonus_tiers")
          .select("id, worker_id, threshold_units, bonus_amount, label, active")
          .or(`worker_id.is.null,worker_id.eq.${selectedWorker.id}`)
          .eq("active", true)
          .order("threshold_units", { ascending: true }),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
        { data: [] },
      ];

  const timeList = timeEntries ?? [];
  const breakList = breaks ?? [];
  const unitList = units ?? [];
  const tiers = bonusTiers ?? [];
  const hourlyRate = Number(paySettings?.hourly_rate ?? 0);

  const rows = workDays.map((date) => {
    const dateKey = getDateKey(date);
    const dayEntries = timeList.filter(
      (entry) => getDateKey(new Date(entry.clock_in_at)) === dateKey,
    );
    const dayBreaks = breakList.filter(
      (entry) => getDateKey(new Date(entry.break_start_at)) === dateKey,
    );
    const dayUnits = unitList.filter((entry) => entry.work_date === dateKey);
    const firstEntry = dayEntries[0] ?? null;
    const firstBreak = dayBreaks[0] ?? null;
    const firstUnits = dayUnits[0] ?? null;
    const grossHours = dayEntries.reduce(
      (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
      0,
    );
    const lunchHours = getBreakHours(dayBreaks);
    const totalHours = Math.max(0, grossHours - lunchHours);
    const unitTotal = dayUnits.reduce((total, entry) => total + entry.quantity, 0);

    return {
      date,
      dateKey,
      firstBreak,
      firstEntry,
      firstUnits,
      lunchMinutes: Math.round(lunchHours * 60),
      totalHours,
      unitTotal,
    };
  });

  const weekHours = rows.reduce((total, row) => total + row.totalHours, 0);
  const weekUnits = rows.reduce((total, row) => total + row.unitTotal, 0);
  const hourlyPay = weekHours * hourlyRate;
  const bonusPay = tiers
    .filter((tier) => weekUnits >= tier.threshold_units)
    .reduce((total, tier) => total + Number(tier.bonus_amount), 0);
  const totalPay = hourlyPay + bonusPay;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Tracking"
        description="Review and edit worker weekly time, lunch, units, and pay."
      />

      <section className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-base font-semibold">Workers</h2>
          <div className="mt-4 space-y-2">
            {workers.map((worker) => {
              const selected = worker.id === selectedWorker?.id;

              return (
                <Link
                  className={`block rounded-md border px-3 py-2 text-sm ${
                    selected
                      ? "border-accent bg-surface-muted font-semibold"
                      : "border-border bg-background"
                  }`}
                  href={`/time-tracking?worker=${worker.id}&week=${getDateKey(weekStart)}`}
                  key={worker.id}
                >
                  {getProfileLabel(worker)}
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  {selectedWorker ? getProfileLabel(selectedWorker) : "No worker selected"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {displayDateFormatter.format(weekStart)} -{" "}
                  {displayDateFormatter.format(addDays(weekStart, 5))}
                </p>
              </div>
              {selectedWorker ? (
                <div className="flex gap-2">
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:bg-surface-muted"
                    href={getWeekLink(selectedWorker.id, weekStart, -7)}
                  >
                    Previous Week
                  </Link>
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:bg-surface-muted"
                    href={getWeekLink(selectedWorker.id, weekStart, 7)}
                  >
                    Next Week
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Total Hours
                </p>
                <p className="mt-2 text-xl font-semibold">{weekHours.toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Hourly Pay
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {moneyFormatter.format(hourlyPay)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Bonus Pay
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {moneyFormatter.format(bonusPay)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Full Pay
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {moneyFormatter.format(totalPay)}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[1120px] text-sm">
                <div className="grid grid-cols-[120px_132px_132px_110px_110px_110px_120px_220px] items-center gap-3 border-b border-border px-4 py-3 font-medium text-muted-foreground">
                  <span>Date</span>
                  <span>Start</span>
                  <span>End</span>
                  <span>Lunch Min</span>
                  <span>Units</span>
                  <span>Total Hours</span>
                  <span>Day Pay</span>
                  <span>Manage</span>
                </div>
                <div className="divide-y divide-border">
                  {selectedWorker
                    ? rows.map((row) => (
                        <form
                          action={updateWorkerTimesheetDay}
                          className="grid grid-cols-[120px_132px_132px_110px_110px_110px_120px_220px] items-center gap-3 px-4 py-2"
                          key={row.dateKey}
                        >
                          <input
                            name="worker_id"
                            type="hidden"
                            value={selectedWorker.id}
                          />
                          <input name="work_date" type="hidden" value={row.dateKey} />
                          <input
                            name="time_entry_id"
                            type="hidden"
                            value={row.firstEntry?.id ?? ""}
                          />
                          <input
                            name="break_id"
                            type="hidden"
                            value={row.firstBreak?.id ?? ""}
                          />
                          <input
                            name="unit_entry_id"
                            type="hidden"
                            value={row.firstUnits?.id ?? ""}
                          />
                          <span className="font-semibold">
                            {weekdayFormatter.format(row.date)}{" "}
                            {displayDateFormatter.format(row.date)}
                          </span>
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3"
                            defaultValue={getTimeValue(row.firstEntry?.clock_in_at)}
                            name="clock_in"
                            type="time"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3"
                            defaultValue={getTimeValue(row.firstEntry?.clock_out_at)}
                            name="clock_out"
                            type="time"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3"
                            defaultValue={row.lunchMinutes}
                            min="0"
                            name="lunch_minutes"
                            step="1"
                            type="number"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3"
                            defaultValue={row.unitTotal}
                            min="0"
                            name="units"
                            step="1"
                            type="number"
                          />
                          <span className="font-medium">{row.totalHours.toFixed(2)}</span>
                          <span className="font-medium">
                            {moneyFormatter.format(row.totalHours * hourlyRate)}
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <Button className="h-10 px-3" name="action" type="submit" value="save">
                              Save
                            </Button>
                            <Button
                              className="h-10 px-3"
                              name="action"
                              type="submit"
                              value="clear"
                              variant="secondary"
                            >
                              Clear
                            </Button>
                          </div>
                        </form>
                      ))
                    : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
