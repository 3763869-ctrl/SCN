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

const workerStats = [
  {
    title: "Today's Hours",
    value: "0.00",
    description: "Time tracking placeholder",
    icon: Clock3,
  },
  {
    title: "Today's Units",
    value: "0",
    description: "Production placeholder",
    icon: PackagePlus,
  },
  {
    title: "Bonus Progress",
    value: "0%",
    description: "Bonus placeholder",
    icon: BadgeDollarSign,
  },
];

export default async function WorkerPage() {
  const profile = await requireProfile();

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
            Clock activity and unit entry placeholders for future production
            workflows.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button className="h-12">
            <Clock3 className="mr-2 h-4 w-4" aria-hidden="true" />
            Clock In
          </Button>
          <Button className="h-12" variant="secondary">
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Clock Out
          </Button>
          <Button className="h-12" variant="secondary">
            <PackagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add Units
          </Button>
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
