import {
  Activity,
  BadgeDollarSign,
  Clock3,
  LogOut,
  PackagePlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { requireProfile } from "@/features/auth/session";
import { addUnits, clockIn, clockOut } from "@/features/worker/actions";
import { getWorkerDashboardData } from "@/features/worker/metrics";

export default async function WorkerPage() {
  const profile = await requireProfile();
  const dashboard = await getWorkerDashboardData(profile.id);
  const workerStats = [
    {
      title: "Today's Hours",
      value: dashboard.todayHours.toFixed(2),
      description: dashboard.openEntry ? "Currently clocked in" : "No active clock",
      icon: Clock3,
    },
    {
      title: "Today's Units",
      value: String(dashboard.todayUnits),
      description: "Pending and approved units",
      icon: PackagePlus,
    },
    {
      title: "Bonus Progress",
      value: `${dashboard.bonusProgress}%`,
      description: "Placeholder goal: 100 daily units",
      icon: BadgeDollarSign,
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
              SCN
            </span>
            <div>
              <p className="text-sm font-semibold">Worker Workspace</p>
              <p className="text-xs text-muted-foreground">
                {profile.full_name ?? profile.email}
              </p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Worker Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Clock activity and unit entry foundations for future production and
            payroll workflows.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <form action={clockIn}>
            <Button className="h-12 w-full" disabled={Boolean(dashboard.openEntry)} type="submit">
              <Clock3 className="mr-2 h-4 w-4" aria-hidden="true" />
              Clock In
            </Button>
          </form>
          <form action={clockOut}>
            <Button className="h-12 w-full" disabled={!dashboard.openEntry} type="submit" variant="secondary">
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Clock Out
            </Button>
          </form>
          <a
            className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold transition hover:bg-surface-muted"
            href="#add-units"
          >
            <PackagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add Units
          </a>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {workerStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <article
                key={stat.title}
                className="rounded-lg border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted text-accent">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stat.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            action={addUnits}
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            id="add-units"
          >
            <h2 className="text-base font-semibold">Add Units</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit today&apos;s completed production units for admin review.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="quantity">
                  Units
                </label>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
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
              <Button type="submit">
                <PackagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Submit Units
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold">Today&apos;s Activity</h2>
            <div className="mt-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Time Entries
                </h3>
                <div className="mt-3 space-y-2">
                  {dashboard.timeEntries.length ? (
                    dashboard.timeEntries.map((entry) => (
                      <div
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                        key={entry.id}
                      >
                        <span>
                          {new Date(entry.clock_in_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          to{" "}
                          {entry.clock_out_at
                            ? new Date(entry.clock_out_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "active"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No time entries yet today.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Unit Entries
                </h3>
                <div className="mt-3 space-y-2">
                  {dashboard.unitEntries.length ? (
                    dashboard.unitEntries.map((entry) => (
                      <div
                        className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                        key={entry.id}
                      >
                        <span>{entry.quantity} units</span>
                        <span className="capitalize text-muted-foreground">
                          {entry.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No production units submitted today.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {profile.role === "admin" ? (
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-5 w-5 text-accent" />
              <div>
                <h2 className="text-base font-semibold">Admin View</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Admin users can access this worker dashboard foundation for
                  future oversight and worker-related information.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
