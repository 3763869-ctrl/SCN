import {
  Activity,
  BadgeDollarSign,
  Clock3,
  FileText,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";

const stats = [
  {
    title: "Active Clients",
    value: "24",
    description: "Placeholder client count",
    icon: Users,
  },
  {
    title: "Open Time Entries",
    value: "128",
    description: "Awaiting review",
    icon: Clock3,
  },
  {
    title: "Production Units",
    value: "4,820",
    description: "Current period total",
    icon: Activity,
  },
  {
    title: "Payroll Draft",
    value: "$38.4k",
    description: "Estimated weekly payroll",
    icon: BadgeDollarSign,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
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
                Placeholder summary for upcoming jobs and production status.
              </p>
            </div>
            <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {["Time review", "Unit approvals", "Invoice preparation"].map(
              (item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
                >
                  <span className="text-sm font-medium">{item}</span>
                  <span className="text-sm text-muted-foreground">
                    Phase {index + 1}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Recent Activity</h2>
          <div className="mt-5 space-y-4">
            {[
              "Worker record placeholder",
              "Expense review placeholder",
              "Tax report placeholder",
            ].map((activity) => (
              <div key={activity} className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                <div>
                  <p className="text-sm font-medium">{activity}</p>
                  <p className="text-sm text-muted-foreground">
                    Ready for future business logic.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
