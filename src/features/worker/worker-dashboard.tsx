"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarDays,
  Clock3,
  Gift,
  LogOut,
  PackagePlus,
  PartyPopper,
  Pause,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addUnits,
  clockIn,
  clockOut,
  endLunch,
  startLunch,
  type WorkerActionState,
} from "@/features/worker/actions";

type WorkerDashboardData = {
  openEntry: { id: string; clock_in_at: string; clock_out_at: string | null } | null;
  openBreak: { id: string; break_start_at: string; break_end_at: string | null } | null;
  todayHours: number;
  todayBreakHours: number;
  todayUnits: number;
  weekHours: number;
  weekUnits: number;
  weeklyUnitGoal: number;
  bonusProgress: number;
  payrollSchedule: "weekly" | "semi_monthly";
  hourlyRate: number;
  payrollEstimate: number;
  payrollPeriod: { start: string; end: string };
  calendarDays: Array<{
    date: string;
    dayLabel: string;
    hours: number;
    units: number;
  }>;
  bonusTiers: Array<{
    id: string;
    threshold_units: number;
    bonus_amount: number;
    label: string | null;
  }>;
  earnedBonuses: Array<{
    id: string;
    threshold_units: number;
    bonus_amount: number;
    label: string | null;
  }>;
  nextBonus: {
    id: string;
    threshold_units: number;
    bonus_amount: number;
    label: string | null;
  } | null;
};

type WorkerDashboardProps = {
  workerName: string;
  data: WorkerDashboardData;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

function getDurationLabel(hours: number) {
  const totalSeconds = Math.max(0, Math.floor(hours * 3600));
  const hourValue = Math.floor(totalSeconds / 3600);
  const minuteValue = Math.floor((totalSeconds % 3600) / 60);
  const secondValue = totalSeconds % 60;

  return [hourValue, minuteValue, secondValue]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function getShortDateLabel(date: string) {
  const [, month, day] = date.split("-");

  return `${Number(month)}/${Number(day)}`;
}

export function WorkerDashboard({ workerName, data }: WorkerDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"clock" | "units">("clock");
  const [message, setMessage] = useState<string | null>(null);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [celebration, setCelebration] = useState<WorkerActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  const liveTodayHours = useMemo(() => {
    if (!data.openEntry) {
      return data.todayHours;
    }

    const activeMs = now - new Date(data.openEntry.clock_in_at).getTime();
    const activeHours = Math.max(0, activeMs / 36e5);
    const activeBreakHours = data.openBreak
      ? Math.max(0, (now - new Date(data.openBreak.break_start_at).getTime()) / 36e5)
      : 0;

    return Math.max(0, data.todayHours + activeHours - activeBreakHours);
  }, [data.openBreak, data.openEntry, data.todayHours, now]);

  function runAction(action: () => Promise<WorkerActionState>) {
    startTransition(async () => {
      const result = await action();

      setMessage(result.message);
      if (result.bonusAmount) {
        setCelebration(result);
      }
      router.refresh();
    });
  }

  function continueClockOut() {
    setShowClockOutConfirm(false);

    if (!data.todayUnits) {
      setActiveTab("units");
      setMessage("Add today's units before clocking out for the day.");
      return;
    }

    runAction(clockOut);
  }

  function chooseLunchPause() {
    setShowClockOutConfirm(false);

    if (data.openBreak) {
      setMessage("Lunch pause is already running.");
      return;
    }

    runAction(startLunch);
  }

  function submitUnits(formData: FormData) {
    startTransition(async () => {
      const result = await addUnits({ message: null }, formData);

      setMessage(result.message);
      if (result.bonusAmount) {
        setCelebration(result);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {celebration?.bonusAmount ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 px-4 text-center text-white">
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }, (_, index) => (
              <span
                className="absolute bottom-[-80px] h-14 w-10 animate-[float-up_2.8s_ease-in_forwards] rounded-full"
                key={index}
                style={{
                  animationDelay: `${index * 90}ms`,
                  background:
                    index % 3 === 0
                      ? "#14b8a6"
                      : index % 3 === 1
                        ? "#f59e0b"
                        : "#ef4444",
                  left: `${8 + ((index * 17) % 84)}%`,
                }}
              />
            ))}
          </div>
          <div className="relative max-w-md rounded-lg bg-surface p-8 text-foreground shadow-2xl">
            <PartyPopper className="mx-auto h-12 w-12 text-accent" />
            <p className="mt-4 text-sm font-semibold uppercase text-muted-foreground">
              Bonus unlocked
            </p>
            <h2 className="mt-2 text-4xl font-semibold">
              {moneyFormatter.format(celebration.bonusAmount)}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {celebration.bonusLabel}
            </p>
            <Button className="mt-6" onClick={() => setCelebration(null)}>
              Nice
            </Button>
          </div>
        </div>
      ) : null}

      {showClockOutConfirm ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/70 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-muted text-accent">
                <LogOut className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  Are you done working today?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  If you are leaving for lunch or a short break, press Lunch
                  Pause so the same shift continues when you come back. If you
                  are finished for today, continue to clock out and add today&apos;s
                  units.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Button
                disabled={!data.openEntry || Boolean(data.openBreak) || isPending}
                onClick={chooseLunchPause}
                type="button"
                variant="secondary"
              >
                <Pause className="mr-2 h-4 w-4" />
                Lunch Pause
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setShowClockOutConfirm(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button disabled={isPending} onClick={continueClockOut} type="button">
                End Day
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Hi, {workerName}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep today simple: clock, lunch, units, done.
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-border bg-surface p-1">
          <button
            className={`rounded px-4 py-2 text-sm font-semibold ${
              activeTab === "clock" ? "bg-surface-muted" : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("clock")}
            type="button"
          >
            Clock
          </button>
          <button
            className={`rounded px-4 py-2 text-sm font-semibold ${
              activeTab === "units" ? "bg-surface-muted" : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("units")}
            type="button"
          >
            Units
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      {activeTab === "clock" ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Today&apos;s Clock
                </p>
                <p className="mt-4 font-mono text-5xl font-semibold">
                  {getDurationLabel(liveTodayHours)}
                </p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-md bg-surface-muted text-accent">
                <Clock3 className="h-6 w-6" />
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                className="h-12"
                disabled={Boolean(data.openEntry) || isPending}
                onClick={() => runAction(clockIn)}
              >
                <Play className="mr-2 h-4 w-4" />
                Clock In
              </Button>
              <Button
                className="h-12"
                disabled={!data.openEntry || isPending}
                onClick={() => setShowClockOutConfirm(true)}
                variant="secondary"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Clock Out
              </Button>
              <Button
                className="h-12"
                disabled={!data.openEntry || Boolean(data.openBreak) || isPending}
                onClick={() => runAction(startLunch)}
                variant="secondary"
              >
                <Pause className="mr-2 h-4 w-4" />
                Lunch Pause
              </Button>
              <Button
                className="h-12"
                disabled={!data.openBreak || isPending}
                onClick={() => runAction(endLunch)}
                variant="secondary"
              >
                <Play className="mr-2 h-4 w-4" />
                Back From Lunch
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Lunch today: {getDurationLabel(data.todayBreakHours)}
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Payroll Estimate</h2>
                <BadgeDollarSign className="h-5 w-5 text-accent" />
              </div>
              <p className="mt-4 text-3xl font-semibold">
                {moneyFormatter.format(data.payrollEstimate)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.payrollSchedule === "weekly" ? "Weekly" : "Semi-monthly"}{" "}
                period: {data.payrollPeriod.start} to {data.payrollPeriod.end}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rate: {moneyFormatter.format(data.hourlyRate)} / hour
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Hours Calendar</h2>
                <CalendarDays className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {data.calendarDays.map((day) => (
                  <div
                    className="rounded-md border border-border bg-background p-2 text-center"
                    key={day.date}
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      {day.dayLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getShortDateLabel(day.date)}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {day.hours.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">hrs</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <form
            action={submitUnits}
            className="rounded-lg border border-border bg-surface p-6 shadow-sm"
          >
            <h2 className="text-base font-semibold">Add Today&apos;s Units</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Submit units before clocking out for the day.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="quantity">
                  Units
                </label>
                <input
                  className="mt-2 h-12 w-full rounded-md border border-border bg-background px-3 text-lg font-semibold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  id="quantity"
                  min="1"
                  name="quantity"
                  required
                  step="1"
                  type="number"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  id="notes"
                  name="notes"
                />
              </div>
              <Button className="h-12 w-full" disabled={isPending} type="submit">
                <PackagePlus className="mr-2 h-4 w-4" />
                Submit Units
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Weekly Goal</h2>
                <Gift className="h-5 w-5 text-accent" />
              </div>
              <p className="mt-4 text-3xl font-semibold">
                {data.weekUnits} / {data.weeklyUnitGoal}
              </p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${data.bonusProgress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.nextBonus
                  ? `${data.nextBonus.threshold_units - data.weekUnits} units to ${moneyFormatter.format(data.nextBonus.bonus_amount)}`
                  : "All visible bonus tiers reached."}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold">Bonus Tiers</h2>
              <div className="mt-4 space-y-2">
                {data.bonusTiers.map((tier) => {
                  const earned = data.weekUnits >= tier.threshold_units;

                  return (
                    <div
                      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                      key={tier.id}
                    >
                      <span>
                        {tier.label || `${tier.threshold_units} units`}{" "}
                        <span className="text-muted-foreground">
                          ({tier.threshold_units})
                        </span>
                      </span>
                      <span className={earned ? "font-semibold text-accent" : ""}>
                        {earned ? "Earned " : ""}
                        {moneyFormatter.format(tier.bonus_amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
