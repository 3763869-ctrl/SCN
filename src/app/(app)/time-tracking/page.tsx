import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { getProfileLabel } from "@/features/admin/data";
import {
  completeTimesheetWeek,
  reopenTimesheetWeek,
} from "@/features/admin/payroll-actions";
import {
  completeProductionUnitsPeriod,
  reopenProductionUnitsPeriod,
  updateWorkerTimesheetDay,
} from "@/features/admin/worker-actions";
import { getBreakHours, getHoursBetween } from "@/features/worker/metrics";
import {
  addDaysToDateKey,
  EASTERN_TIME_ZONE,
  getEasternDateKey,
  getUtcDateFromEasternDateTime,
} from "@/lib/dates/eastern-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});
const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

function getStartOfWeek(value?: string) {
  const dateKey = value || getEasternDateKey();
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());

  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);

  return next;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTimeValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: EASTERN_TIME_ZONE,
  })
    .format(new Date(value))
    .replace("24:", "00:");
}

function getWeekLink(workerId: string, weekStart: Date, offsetDays: number) {
  const target = addDays(weekStart, offsetDays);

  return `/time-tracking?worker=${workerId}&week=${getDateKey(target)}`;
}

function getWeekStatusStyles(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "partial") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  if (status === "completed") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (status === "reopened") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-border bg-surface-muted text-muted-foreground";
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
  const weekStartKey = getDateKey(weekStart);
  const weekEndKey = getDateKey(weekEnd);
  const weekQueryStart = getUtcDateFromEasternDateTime(weekStartKey);
  const weekQueryEnd = getUtcDateFromEasternDateTime(weekEndKey);
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
    { data: timesheetWeek },
    { data: unitPeriod },
    { data: payroll },
  ] = selectedWorker
    ? await Promise.all([
        supabase
          .from("time_entries")
          .select("id, worker_id, clock_in_at, clock_out_at, notes")
          .eq("worker_id", selectedWorker.id)
          .gte("clock_in_at", weekQueryStart.toISOString())
          .lt("clock_in_at", weekQueryEnd.toISOString())
          .order("clock_in_at", { ascending: true }),
        supabase
          .from("time_breaks")
          .select("id, time_entry_id, worker_id, break_start_at, break_end_at")
          .eq("worker_id", selectedWorker.id)
          .gte("break_start_at", weekQueryStart.toISOString())
          .lt("break_start_at", weekQueryEnd.toISOString())
          .order("break_start_at", { ascending: true }),
        supabase
          .from("production_units")
          .select("id, worker_id, quantity, work_date, status")
          .eq("worker_id", selectedWorker.id)
          .gte("work_date", getDateKey(weekStart))
          .lt("work_date", addDaysToDateKey(getDateKey(weekStart), 7))
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
        supabase
          .from("timesheet_weeks")
          .select("id, status, week_start, week_end")
          .eq("worker_id", selectedWorker.id)
          .eq("week_start", getDateKey(weekStart))
          .maybeSingle(),
        supabase
          .from("production_unit_periods")
          .select("id, status, period_start, period_end")
          .eq("worker_id", selectedWorker.id)
          .eq("period_start", getDateKey(weekStart))
          .eq("period_end", getDateKey(addDays(weekStart, 5)))
          .maybeSingle(),
        supabase
          .from("worker_payrolls")
          .select("id, status, total_owed, total_paid, balance_remaining")
          .eq("worker_id", selectedWorker.id)
          .eq("week_start", getDateKey(weekStart))
          .maybeSingle(),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
        { data: [] },
        { data: null },
        { data: null },
        { data: null },
      ];

  const timeList = timeEntries ?? [];
  const breakList = breaks ?? [];
  const unitList = units ?? [];
  const tiers = bonusTiers ?? [];
  const hourlyRate = Number(paySettings?.hourly_rate ?? 0);

  const rows = workDays.map((date) => {
    const dateKey = getDateKey(date);
    const dayEntries = timeList.filter(
      (entry) => getEasternDateKey(new Date(entry.clock_in_at)) === dateKey,
    );
    const dayBreaks = breakList.filter(
      (entry) => getEasternDateKey(new Date(entry.break_start_at)) === dateKey,
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
  const weekStatus = timesheetWeek?.status ?? "open";
  const displayStatus =
    weekStatus === "completed" && payroll?.status ? payroll.status : weekStatus;
  const isWeekLocked = weekStatus === "completed";
  const isUnitPeriodLocked = unitPeriod?.status === "completed";
  const statusLabel =
    displayStatus === "completed" || displayStatus === "due"
      ? "Sent to Payroll"
      : displayStatus === "partial"
        ? "Partial"
        : displayStatus === "paid"
          ? "Paid"
          : displayStatus === "reopened"
        ? "Needs Review"
        : "Open";

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
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">
                    {selectedWorker
                      ? getProfileLabel(selectedWorker)
                      : "No worker selected"}
                  </h2>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${getWeekStatusStyles(displayStatus)}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {displayDateFormatter.format(weekStart)} -{" "}
                  {displayDateFormatter.format(addDays(weekStart, 5))}
                </p>
                {payroll ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payroll: {moneyFormatter.format(Number(payroll.total_paid))} paid,{" "}
                    {moneyFormatter.format(Number(payroll.balance_remaining))} remaining.
                  </p>
                ) : null}
                {isWeekLocked ? (
                  <p className="mt-1 text-sm font-medium text-orange-700">
                    This week is locked. Reopen it before making changes.
                  </p>
                ) : null}
              </div>
              {selectedWorker ? (
                <div className="flex flex-wrap gap-2">
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
                  {timesheetWeek?.status === "completed" ? (
                    <form action={reopenTimesheetWeek}>
                      <input
                        name="timesheet_week_id"
                        type="hidden"
                        value={timesheetWeek.id}
                      />
                      <input name="payroll_id" type="hidden" value={payroll?.id ?? ""} />
                      <Button className="h-10" type="submit" variant="secondary">
                        Reopen Week
                      </Button>
                    </form>
                  ) : (
                    <form action={completeTimesheetWeek}>
                      <input
                        name="worker_id"
                        type="hidden"
                        value={selectedWorker.id}
                      />
                      <input
                        name="week_start"
                        type="hidden"
                        value={getDateKey(weekStart)}
                      />
                      <Button className="h-10" type="submit">
                        Complete Week
                      </Button>
                    </form>
                  )}
                  {unitPeriod?.status === "completed" ? (
                    <form action={reopenProductionUnitsPeriod}>
                      <input name="period_id" type="hidden" value={unitPeriod.id} />
                      <Button className="h-10" type="submit" variant="secondary">
                        Reopen Units
                      </Button>
                    </form>
                  ) : (
                    <form action={completeProductionUnitsPeriod}>
                      <input
                        name="worker_id"
                        type="hidden"
                        value={selectedWorker.id}
                      />
                      <input
                        name="period_start"
                        type="hidden"
                        value={getDateKey(weekStart)}
                      />
                      <input
                        name="period_end"
                        type="hidden"
                        value={getDateKey(addDays(weekStart, 5))}
                      />
                      <Button className="h-10" type="submit" variant="secondary">
                        Complete Units
                      </Button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
              <p className="font-semibold">
                Units approval:{" "}
                {isUnitPeriodLocked
                  ? "Completed and ready for invoicing"
                  : "Open for review"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Invoices only use approved units. Complete Units locks finished
                dates only; today and future dates stay open.
              </p>
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
                  Weekly Units
                </p>
                <p className="mt-2 text-xl font-semibold">{weekUnits}</p>
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
                            className="h-10 rounded-md border border-border bg-background px-3 disabled:bg-surface-muted disabled:text-muted-foreground"
                            defaultValue={getTimeValue(row.firstEntry?.clock_in_at)}
                            disabled={isWeekLocked}
                            name="clock_in"
                            type="time"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 disabled:bg-surface-muted disabled:text-muted-foreground"
                            defaultValue={getTimeValue(row.firstEntry?.clock_out_at)}
                            disabled={isWeekLocked}
                            name="clock_out"
                            type="time"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 disabled:bg-surface-muted disabled:text-muted-foreground"
                            defaultValue={row.lunchMinutes}
                            disabled={isWeekLocked}
                            min="0"
                            name="lunch_minutes"
                            step="1"
                            type="number"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 disabled:bg-surface-muted disabled:text-muted-foreground"
                            defaultValue={row.unitTotal}
                            disabled={isWeekLocked || isUnitPeriodLocked}
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
                            <Button
                              className="h-10 px-3"
                              disabled={isWeekLocked}
                              name="action"
                              type="submit"
                              value="save"
                            >
                              Save
                            </Button>
                            <ConfirmSubmitButton
                              className="h-10 px-3"
                              confirmLabel="Clear Day"
                              description="This will delete this day's clock times, lunch break, and units for this worker. This cannot be undone."
                              disabled={isWeekLocked || isUnitPeriodLocked}
                              name="action"
                              title="Clear this day?"
                              value="clear"
                              variant="secondary"
                            >
                              Clear
                            </ConfirmSubmitButton>
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
