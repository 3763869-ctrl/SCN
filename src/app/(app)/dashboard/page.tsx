import {
  BadgeDollarSign,
  Handshake,
  PackageCheck,
  ReceiptText,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getFinancialManagementData } from "@/features/admin/financial-data";
import { getPartnerOperationsData } from "@/features/admin/partner-data";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

export default async function DashboardPage() {
  const [operations, finances] = await Promise.all([
    getPartnerOperationsData(),
    getFinancialManagementData(),
  ]);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartKey = monthStart.toISOString().slice(0, 10);
  const expensesThisMonth = finances.expenses
    .filter((expense) => expense.expense_date >= monthStartKey)
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const stats = [
    {
      title: "Units Today",
      value: String(finances.stats.unitsToday),
      description: "Production entered today",
      icon: PackageCheck,
    },
    {
      title: "Units This Week",
      value: String(finances.stats.unitsThisWeek),
      description: "Current week production",
      icon: PackageCheck,
    },
    {
      title: "Workers Online",
      value: String(finances.stats.workersOnline),
      description: "Workers currently clocked in",
      icon: Users,
    },
    {
      title: "Partners Working Today",
      value: String(operations.stats.partnersWorkingToday),
      description: "Partners with worker activity",
      icon: Handshake,
    },
    {
      title: "Income Today",
      value: moneyFormatter.format(finances.stats.todayIncome),
      description: "Payments received today",
      icon: BadgeDollarSign,
    },
    {
      title: "Income This Month",
      value: moneyFormatter.format(finances.stats.monthlyIncome),
      description: "Income received this month",
      icon: BadgeDollarSign,
    },
    {
      title: "Expenses This Month",
      value: moneyFormatter.format(expensesThisMonth),
      description: "Manual expenses this month",
      icon: ReceiptText,
    },
    {
      title: "Active Partners",
      value: String(finances.stats.partnersActive),
      description: "Partners currently active",
      icon: Handshake,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="A simple daily view of production, income, and expenses. Full financial analysis lives in Reports."
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
              Quick scan of assigned workers and production.
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
                Lifetime:{" "}
                <span className="font-semibold text-foreground">{summary.lifetimeUnits}</span>{" "}
                units
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
