"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  BellRing,
  CalendarDays,
  CheckCircle2,
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
import { EASTERN_TIME_ZONE } from "@/lib/dates/eastern-time";
import { formatHoursShort } from "@/lib/format/duration";

type WorkerDashboardData = {
  openEntry: { id: string; clock_in_at: string; clock_out_at: string | null } | null;
  openBreak: {
    id: string;
    break_start_at: string;
    break_end_at: string | null;
    break_type: string | null;
  } | null;
  breakEntries: Array<{
    id: string;
    time_entry_id: string;
    break_start_at: string;
    break_end_at: string | null;
    break_type: string | null;
  }>;
  timeEntries: Array<{
    id: string;
    clock_in_at: string;
    clock_out_at: string | null;
    notes: string | null;
  }>;
  todayHours: number;
  todayBreakHours: number;
  todayUnits: number;
  weekHours: number;
  weekUnits: number;
  weeklyUnitGoal: number;
  bonusProgress: number;
  payrollSchedule: "weekly" | "semi_monthly";
  hourlyRate: number;
  hourlyPayEstimate: number;
  bonusPayEstimate: number;
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
  pushSubscriptionActive: boolean;
  recentPresenceChecks: Array<{
    id: string;
    status: string;
    scheduled_at: string;
    sent_at: string | null;
    expires_at: string;
    responded_at: string | null;
    auto_clock_out_at: string | null;
  }>;
};

type WorkerDashboardProps = {
  workerName: string;
  data: WorkerDashboardData;
  notificationPublicKey: string;
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

function getTimeLabel(value: number, mode: "12" | "24") {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: mode === "12",
    minute: "2-digit",
    second: "2-digit",
    timeZone: EASTERN_TIME_ZONE,
    timeZoneName: "short",
  }).format(value);
}

function getSessionTimeLabel(value: string, mode: "12" | "24") {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: mode === "12",
    minute: "2-digit",
    timeZone: EASTERN_TIME_ZONE,
  }).format(new Date(value));
}

function getSessionHours(start: string, end: string | null, now: number) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : now;

  return Math.max(0, (endMs - startMs) / 36e5);
}

function getApplicationServerKey(publicKey: string) {
  const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
  const base64 = `${publicKey}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function getPresenceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    answered: "Answered",
    auto_clocked_out: "Auto clocked out",
    cancelled: "Cancelled",
    failed: "Failed",
    missed: "Clock paused",
    scheduled: "Scheduled",
    sent: "Waiting for answer",
  };

  return labels[status] ?? status;
}

export function WorkerDashboard({
  workerName,
  data,
  notificationPublicKey,
}: WorkerDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"clock" | "units">("clock");
  const [timeDisplayMode, setTimeDisplayMode] = useState<"12" | "24">("12");
  const [message, setMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationState, setNotificationState] = useState<
    "checking" | "unsupported" | "missing-key" | "denied" | "enabled" | "disabled"
  >(
    !notificationPublicKey
      ? "missing-key"
      : data.pushSubscriptionActive
        ? "enabled"
        : "disabled",
  );
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [endDayRequiresUnits, setEndDayRequiresUnits] = useState(false);
  const [clockOutComplete, setClockOutComplete] = useState(false);
  const [celebration, setCelebration] = useState<WorkerActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const notificationsRequired = Boolean(notificationPublicKey);
  const isPresencePause = data.openBreak?.break_type === "presence_pause";

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

  const currentTimeLabel = useMemo(
    () => getTimeLabel(now, timeDisplayMode),
    [now, timeDisplayMode],
  );
  const todaySessions = useMemo(
    () =>
      data.timeEntries
        .map((entry) => {
          const sessionBreakHours = data.breakEntries
            .filter((breakEntry) => breakEntry.time_entry_id === entry.id)
            .reduce(
              (total, breakEntry) =>
                total +
                getSessionHours(
                  breakEntry.break_start_at,
                  breakEntry.break_end_at,
                  now,
                ),
              0,
            );

          return {
            ...entry,
            netHours: Math.max(
              0,
              getSessionHours(entry.clock_in_at, entry.clock_out_at, now) -
                sessionBreakHours,
            ),
          };
        })
        .sort(
          (firstEntry, secondEntry) =>
            new Date(firstEntry.clock_in_at).getTime() -
            new Date(secondEntry.clock_in_at).getTime(),
        ),
    [data.breakEntries, data.timeEntries, now],
  );

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

  async function enableNotifications() {
    setNotificationMessage("Chrome should ask for permission now. Choose Allow.");

    if (!notificationPublicKey) {
      setNotificationMessage(
        "Notifications are not configured on this site yet. Ask admin to add the VAPID keys in Vercel.",
      );
      setNotificationState("missing-key");
      return;
    }

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setNotificationMessage("This browser does not support SCN reminders.");
      setNotificationState("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "denied") {
      setNotificationMessage(
        "Chrome is blocking notifications. Click the lock icon near the address bar, allow notifications for SCN, then press this button again.",
      );
      setNotificationState("denied");
      return;
    }

    if (permission !== "granted") {
      setNotificationMessage("Notifications were not enabled.");
      setNotificationState("disabled");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ??
      (await registration.pushManager.subscribe({
        applicationServerKey: getApplicationServerKey(notificationPublicKey),
        userVisibleOnly: true,
      }));
    const response = await fetch("/api/worker/push-subscription", {
      body: JSON.stringify(subscription.toJSON()),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      setNotificationMessage("SCN could not save this notification setup.");
      setNotificationState("disabled");
      return;
    }

    await registration.showNotification("SCN reminders enabled", {
      body: "You will get a check-in every 30 minutes while clocked in.",
      icon: "/window.svg",
      tag: "scn-reminders-enabled",
    });

    setNotificationMessage(
      "Notifications are enabled. A test notification was sent.",
    );
    setNotificationState("enabled");
    router.refresh();
  }

  function continueClockOut() {
    setShowClockOutConfirm(false);
    setEndDayRequiresUnits(true);
    setActiveTab("units");
    setMessage("Enter today's units to finish clocking out for the day.");
  }

  function chooseLunchPause() {
    setShowClockOutConfirm(false);
    setEndDayRequiresUnits(false);

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

      if (endDayRequiresUnits && result.success) {
        const clockOutResult = await clockOut({ unitsSubmitted: true });

        if (clockOutResult.success) {
          setEndDayRequiresUnits(false);
          setActiveTab("clock");
          setMessage(null);
          if (result.bonusAmount) {
            setCelebration({
              ...result,
              bonusLabel: `${result.bonusLabel}. You are clocked out for the day.`,
            });
          } else {
            setClockOutComplete(true);
          }
        } else {
          setMessage(clockOutResult.message);
        }
      } else if (result.bonusAmount) {
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
              Done
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
                  If you are only going for lunch, press Lunch Pause. If you are
                  finished working today, press End Day. You will enter today&apos;s
                  units next, and then this work session will be clocked out. If
                  you come back later today, clock in again and it will be saved
                  as another session for the same day.
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

      {clockOutComplete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/75 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
            <h2 className="mt-5 text-2xl font-semibold">
              You are clocked out
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your units were entered and your shift is closed for today. Have a
              nice day.
            </p>
            <Button
              className="mt-6 h-12 w-full"
              onClick={() => setClockOutComplete(false)}
              type="button"
            >
              Done
            </Button>
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

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-surface-muted text-accent">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Chrome Check-In Reminders</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                SCN will send a Chrome notification every 30 minutes while you are
                clocked in. Press Yes within 1 minute to stay clocked in. If you
                miss it, your clock pauses until you resume.
              </p>
              {notificationMessage ? (
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {notificationMessage}
                </p>
              ) : notificationState === "missing-key" ? (
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                Reminder setup is not finished yet. Clock-in is still available.
                Click Enable Notifications, then choose Allow in Chrome.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                notificationState === "enabled"
                  ? "bg-accent/10 text-accent"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {notificationState === "enabled"
                ? "Enabled"
                : notificationState === "denied"
                  ? "Blocked in Chrome"
                  : notificationState === "missing-key"
                    ? "Setup needed"
                    : notificationState === "unsupported"
                      ? "Unsupported browser"
                      : "Not enabled"}
            </span>
            <Button
              disabled={notificationState === "enabled" || isPending}
              onClick={enableNotifications}
              type="button"
              variant="secondary"
            >
              Enable Notifications
            </Button>
          </div>
        </div>
      </section>

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
                <p className="mt-2 text-sm text-muted-foreground">
                  Current time: {currentTimeLabel}
                </p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-md bg-surface-muted text-accent">
                <Clock3 className="h-6 w-6" />
              </span>
            </div>

            <div className="mt-5 inline-grid grid-cols-2 rounded-md border border-border bg-background p-1">
              <button
                className={`rounded px-4 py-2 text-sm font-semibold ${
                  timeDisplayMode === "12"
                    ? "bg-surface-muted"
                    : "text-muted-foreground"
                }`}
                onClick={() => setTimeDisplayMode("12")}
                type="button"
              >
                12 hr
              </button>
              <button
                className={`rounded px-4 py-2 text-sm font-semibold ${
                  timeDisplayMode === "24"
                    ? "bg-surface-muted"
                    : "text-muted-foreground"
                }`}
                onClick={() => setTimeDisplayMode("24")}
                type="button"
              >
                24 hr
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                className="h-12"
                disabled={
                  Boolean(data.openEntry) ||
                  isPending ||
                  (notificationsRequired && notificationState !== "enabled")
                }
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
                {isPresencePause ? "Resume Clock" : "Back From Lunch"}
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {isPresencePause
                ? "Your clock is paused. Press Resume Clock when you are back."
                : `Lunch today: ${getDurationLabel(data.todayBreakHours)}`}
              {notificationState !== "enabled" && !data.openEntry
                ? notificationsRequired
                  ? " Enable notifications before clocking in."
                  : " Reminders are not configured yet."
                : ""}
            </p>

            <div className="mt-5 rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Today&apos;s Sessions</h2>
                <span className="text-sm font-semibold text-muted-foreground">
                  Subtotal {getDurationLabel(liveTodayHours)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {todaySessions.length ? (
                  todaySessions.map((session, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      key={session.id}
                    >
                      <div>
                        <p className="font-semibold">
                          Session {index + 1}
                          {!session.clock_out_at ? (
                            <span className="ml-2 rounded bg-accent/10 px-2 py-0.5 text-xs text-accent">
                              Active
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {getSessionTimeLabel(session.clock_in_at, timeDisplayMode)}
                          {" - "}
                          {session.clock_out_at
                            ? getSessionTimeLabel(
                                session.clock_out_at,
                                timeDisplayMode,
                              )
                            : "Now"}
                        </p>
                      </div>
                      <p className="self-center font-mono font-semibold">
                        {getDurationLabel(session.netHours)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    No clock sessions yet today.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Payroll Estimate</h2>
                <BadgeDollarSign className="h-5 w-5 text-accent" />
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                Estimated total
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {moneyFormatter.format(data.payrollEstimate)}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Hourly Pay
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {moneyFormatter.format(data.hourlyPayEstimate)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Bonus Pay
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {moneyFormatter.format(data.bonusPayEstimate)}
                  </p>
                </div>
              </div>
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
              <div className="mt-4 grid grid-cols-6 gap-2">
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
                      {formatHoursShort(day.hours)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Recent Check-Ins</h2>
                <BellRing className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-4 space-y-2">
                {data.recentPresenceChecks.length ? (
                  data.recentPresenceChecks.map((check) => (
                    <div
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      key={check.id}
                    >
                      <p className="font-semibold">
                        {getPresenceStatusLabel(check.status)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getSessionTimeLabel(check.sent_at ?? check.scheduled_at, timeDisplayMode)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    No check-ins yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          {endDayRequiresUnits ? (
            <form
              action={submitUnits}
              className="rounded-lg border border-border bg-surface p-6 shadow-sm"
            >
              <h2 className="text-base font-semibold">Add Today&apos;s Units</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This is required before your final clock out for today.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-medium" htmlFor="quantity">
                    Units
                  </label>
                  <input
                    className="mt-2 h-12 w-full rounded-md border border-border bg-background px-3 text-lg font-semibold outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    id="quantity"
                    min="0"
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
                  Submit Units and Clock Out
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <span className="grid h-12 w-12 place-items-center rounded-md bg-surface-muted text-accent">
                <PackagePlus className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-base font-semibold">
                Units open after End Day
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                To finish your shift, go to the Clock tab, press Clock Out, and
                choose End Day. The units form will open there as the required
                final step.
              </p>
              <Button
                className="mt-5 h-12 w-full"
                onClick={() => setActiveTab("clock")}
                type="button"
                variant="secondary"
              >
                Back to Clock
              </Button>
            </div>
          )}

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
              <h2 className="text-base font-semibold">Bonuses You Can Earn</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.bonusTiers.map((tier) => (
                  <div
                    className="rounded-md border border-border bg-background p-4"
                    key={tier.id}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-accent">
                      <Gift className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-lg font-semibold leading-6">
                      Reach {tier.threshold_units} units this week
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Unlock this bonus when you hit the goal.
                    </p>
                    <p className="mt-3 text-xl font-semibold text-accent">
                      {moneyFormatter.format(tier.bonus_amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
