import {
  BadgeDollarSign,
  FileText,
  HandCoins,
  Handshake,
  PackageCheck,
  ReceiptText,
  WalletCards,
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
  const stats = [
    {
      title: "Revenue",
      value: moneyFormatter.format(finances.stats.totalRevenue),
      description: "Income received in the selected ledger",
      icon: BadgeDollarSign,
    },
    {
      title: "Expenses",
      value: moneyFormatter.format(finances.stats.totalExpenses),
      description: "Manual expenses plus paid payroll",
      icon: ReceiptText,
    },
    {
      title: "Gross Profit",
      value: moneyFormatter.format(finances.stats.grossProfit),
      description: "Revenue after worker and Partner payroll",
      icon: BadgeDollarSign,
    },
    {
      title: "Net Profit",
      value: moneyFormatter.format(finances.stats.netProfit),
      description: "Revenue after all tracked costs",
      icon: BadgeDollarSign,
    },
    {
      title: "Cash Available",
      value: moneyFormatter.format(finances.stats.cashAvailable),
      description: "Business cash after estimated tax reserve",
      icon: WalletCards,
    },
    {
      title: "Outstanding Receivables",
      value: moneyFormatter.format(finances.stats.outstandingReceivables),
      description: "Open invoice balances",
      icon: FileText,
    },
    {
      title: "Payroll Due",
      value: moneyFormatter.format(
        finances.stats.payrollDue + finances.stats.partnerPayrollDue,
      ),
      description: "Worker and Partner payroll balances",
      icon: HandCoins,
    },
    {
      title: "Taxes Reserved",
      value: moneyFormatter.format(finances.stats.taxesReserved),
      description: "Simple estimated reserve from net profit",
      icon: BadgeDollarSign,
    },
    {
      title: "Workers Online",
      value: String(finances.stats.workersOnline),
      description: "Workers currently clocked in",
      icon: Users,
    },
    {
      title: "Partners Active",
      value: String(finances.stats.partnersActive),
      description: "Active Partner business records",
      icon: Handshake,
    },
    {
      title: "Units Today",
      value: String(finances.stats.unitsToday),
      description: "Production units entered today",
      icon: PackageCheck,
    },
    {
      title: "Units This Week",
      value: String(finances.stats.unitsThisWeek),
      description: "Current week production",
      icon: PackageCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        description="Revenue, expenses, profit, payroll, receivables, Partner activity, and production in one operating view."
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
