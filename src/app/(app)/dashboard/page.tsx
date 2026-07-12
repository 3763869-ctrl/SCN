import {
  BadgeDollarSign,
  Clock3,
  FileText,
  HandCoins,
  Handshake,
  PackageCheck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getPartnerOperationsData } from "@/features/admin/partner-data";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

export default async function DashboardPage() {
  const operations = await getPartnerOperationsData();
  const stats = [
    {
      title: "Total Partners",
      value: String(operations.stats.totalPartners),
      description: "Partner business records",
      icon: Handshake,
    },
    {
      title: "Partners Working Today",
      value: String(operations.stats.partnersWorkingToday),
      description: "Partners with worker activity today",
      icon: Clock3,
    },
    {
      title: "Workers Online",
      value: String(operations.stats.workersOnline),
      description: "Workers currently clocked in",
      icon: Users,
    },
    {
      title: "Units Today",
      value: String(operations.stats.unitsToday),
      description: "Production units entered today",
      icon: PackageCheck,
    },
    {
      title: "Units This Week",
      value: String(operations.stats.unitsThisWeek),
      description: "Sunday through Friday production",
      icon: PackageCheck,
    },
    {
      title: "Outstanding Invoices",
      value: moneyFormatter.format(operations.stats.outstandingInvoices),
      description: "Partner invoices not yet paid",
      icon: FileText,
    },
    {
      title: "Partner Payroll Due",
      value: moneyFormatter.format(operations.stats.partnerPayrollDue),
      description: "Flat Partner payroll still open",
      icon: HandCoins,
    },
    {
      title: "Weekly Profit",
      value: moneyFormatter.format(operations.stats.weeklyProfit),
      description: "Current gross profit snapshot",
      icon: BadgeDollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner Dashboard"
        description="Business overview by Partner, worker production, invoices, Partner payroll, and profit."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Partner Overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quick scan of assigned workers, production, and open money.
            </p>
          </div>
          <Handshake className="h-5 w-5 text-accent" aria-hidden="true" />
        </div>

        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-background">
          {operations.partnerSummaries.slice(0, 8).map((summary) => (
            <div
              className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1.2fr_1fr_1fr_1fr]"
              key={summary.partner.id}
            >
              <div>
                <p className="font-semibold">{summary.partner.full_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Worker: {summary.worker?.full_name ?? summary.worker?.email ?? "None"}
                </p>
              </div>
              <p className="text-muted-foreground">
                Today: <span className="font-semibold text-foreground">{summary.todayUnits}</span>{" "}
                units
              </p>
              <p className="text-muted-foreground">
                Week: <span className="font-semibold text-foreground">{summary.weekUnits}</span>{" "}
                units
              </p>
              <p className="text-muted-foreground">
                Open:{" "}
                <span className="font-semibold text-foreground">
                  {moneyFormatter.format(
                    summary.outstandingInvoices + summary.partnerPayrollDue,
                  )}
                </span>
              </p>
            </div>
          ))}
          {!operations.partnerSummaries.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No Partners created yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
