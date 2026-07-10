import {
  Activity,
  BadgeDollarSign,
  Clock3,
  FileText,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  getAdminOperationsData,
  getProfileLabel,
} from "@/features/admin/data";

export default async function DashboardPage() {
  const operations = await getAdminOperationsData();
  const stats = [
    {
      title: "Active Workers",
      value: String(operations.activeWorkers),
      description: "Workers available for time and units",
      icon: Users,
    },
    {
      title: "Open Time Entries",
      value: String(operations.activeClockIns),
      description: "Workers currently clocked in",
      icon: Clock3,
    },
    {
      title: "Pending Units",
      value: String(operations.pendingUnits),
      description: "Submitted units awaiting review",
      icon: Activity,
    },
    {
      title: "Recent Hours",
      value: operations.recentHours.toFixed(2),
      description: "Hours from recent time entries",
      icon: BadgeDollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Operational overview for clients, workers, time, production, and financial workflows."
        actionLabel="New Entry"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Work Pipeline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Time and production records that need operational attention.
              </p>
            </div>
            <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Open clocks", operations.activeClockIns],
              ["Pending unit quantity", operations.pendingUnits],
              ["Active workers", operations.activeWorkers],
            ].map(([item, value]) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
                >
                  <span className="text-sm font-medium">{item}</span>
                  <span className="text-sm text-muted-foreground">{value}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Recent Activity</h2>
          <div className="mt-5 space-y-4">
            {operations.unitEntries.slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                <div>
                  <p className="text-sm font-medium">
                    {entry.quantity} units from{" "}
                    {getProfileLabel(operations.profileMap.get(entry.worker_id))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {entry.status} on {entry.work_date}
                  </p>
                </div>
              </div>
            ))}
            {!operations.unitEntries.length ? (
              <p className="text-sm text-muted-foreground">
                No worker activity submitted yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
