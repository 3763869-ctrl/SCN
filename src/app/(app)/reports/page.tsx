import { Download } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import {
  expenseCategoryLabels,
  getFinancialManagementData,
} from "@/features/admin/financial-data";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

type ReportsPageProps = {
  searchParams?: Promise<{
    category?: string;
    client?: string;
    end?: string;
    partner?: string;
    start?: string;
    vendor?: string;
    worker?: string;
  }>;
};

function csvValue(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getReportCsvHref(rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const csv = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{moneyFormatter.format(value)}</p>
    </div>
  );
}

function ReportList({
  empty,
  rows,
  title,
}: {
  empty: string;
  rows: Array<{ label: string; value: number; meta?: string }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 divide-y divide-border rounded-md border border-border bg-background">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={row.label}>
            <div>
              <p className="font-semibold">{row.label}</p>
              {row.meta ? <p className="mt-1 text-xs text-muted-foreground">{row.meta}</p> : null}
            </div>
            <p className="font-semibold">{moneyFormatter.format(row.value)}</p>
          </div>
        ))}
        {!rows.length ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
        ) : null}
      </div>
    </section>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const data = await getFinancialManagementData({
    category: params?.category,
    clientId: params?.client,
    endDate: params?.end,
    partnerId: params?.partner,
    startDate: params?.start,
    vendor: params?.vendor,
    workerId: params?.worker,
  });
  const reportExportRows = [
    { Report: "Total Revenue", Amount: data.stats.totalRevenue },
    { Report: "Total Expenses", Amount: data.stats.totalExpenses },
    { Report: "Gross Profit", Amount: data.stats.grossProfit },
    { Report: "Net Profit", Amount: data.stats.netProfit },
    { Report: "Outstanding Invoices", Amount: data.stats.outstandingInvoices },
    { Report: "Partner Payroll Due", Amount: data.stats.partnerPayrollDue },
    { Report: "Payroll Costs", Amount: data.stats.payrollCosts },
    { Report: "Software Costs", Amount: data.stats.softwareCosts },
    { Report: "Taxes", Amount: data.stats.taxes },
    { Report: "Estimated Taxes Reserved", Amount: data.stats.taxesReserved },
    { Report: "Business Cash", Amount: data.stats.businessCash },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="SCN financial reports calculated from invoices, payments, payroll, production, and expenses."
      />

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form className="grid flex-1 gap-3 md:grid-cols-6">
            <label className="text-sm font-medium">
              Start
              <input
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={params?.start ?? ""}
                name="start"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              End
              <input
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={params?.end ?? ""}
                name="end"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              Partner
              <select
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={params?.partner ?? ""}
                name="partner"
              >
                <option value="">All Partners</option>
                {data.partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Worker
              <select
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={params?.worker ?? ""}
                name="worker"
              >
                <option value="">All Workers</option>
                {data.workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.full_name ?? worker.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Category
              <select
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={params?.category ?? ""}
                name="category"
              >
                <option value="">All Categories</option>
                {Object.entries(expenseCategoryLabels).map(([category, label]) => (
                  <option key={category} value={category}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button className="mt-7" type="submit">
              Run Report
            </Button>
          </form>
          <div className="flex gap-2">
            <a
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold"
              download="scn-financial-summary.csv"
              href={getReportCsvHref(reportExportRows)}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export Excel
            </a>
            <PrintButton />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Revenue" value={data.stats.totalRevenue} />
        <MetricCard label="Total Expenses" value={data.stats.totalExpenses} />
        <MetricCard label="Gross Profit" value={data.stats.grossProfit} />
        <MetricCard label="Net Profit" value={data.stats.netProfit} />
        <MetricCard label="Outstanding Invoices" value={data.stats.outstandingInvoices} />
        <MetricCard label="Partner Payroll Due" value={data.stats.partnerPayrollDue} />
        <MetricCard label="Payroll Costs" value={data.stats.payrollCosts} />
        <MetricCard label="Business Cash" value={data.stats.businessCash} />
        <MetricCard label="Software Costs" value={data.stats.softwareCosts} />
        <MetricCard label="Taxes" value={data.stats.taxes} />
        <MetricCard label="Estimated Taxes" value={data.stats.taxesReserved} />
        <MetricCard label="Cash Flow" value={data.reports.cashFlow} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ReportList
          empty="No Partner income in this period."
          rows={data.incomeByPartner.map((row) => ({
            label: row.label,
            value: row.amount,
          }))}
          title="Income by Partner"
        />
        <ReportList
          empty="No Client income in this period."
          rows={data.incomeByClient.map((row) => ({
            label: row.label,
            value: row.amount,
          }))}
          title="Income by Client"
        />
        <ReportList
          empty="No expenses in this period."
          rows={data.expenseByCategory.map((row) => ({
            label: row.label,
            value: row.amount,
          }))}
          title="Expense by Category"
        />
        <ReportList
          empty="No vendor spending in this period."
          rows={data.reports.vendorSpending.map((row) => ({
            label: row.vendor,
            value: row.amount,
          }))}
          title="Vendor Spending"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Partner Profitability</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-background text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Partner</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">Worker Payroll</th>
                  <th className="px-3 py-2 text-right">Partner Pay</th>
                  <th className="px-3 py-2 text-right">Expenses</th>
                  <th className="px-3 py-2 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.partnerProfitability.map((row) => (
                  <tr key={row.partner.id}>
                    <td className="px-3 py-3 font-semibold">{row.partner.full_name}</td>
                    <td className="px-3 py-3 text-right">{moneyFormatter.format(row.revenue)}</td>
                    <td className="px-3 py-3 text-right">
                      {moneyFormatter.format(row.workerPayroll)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {moneyFormatter.format(row.partnerCompensation)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {moneyFormatter.format(row.assignedExpenses)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {moneyFormatter.format(row.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Worker Profitability</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-background text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Worker</th>
                  <th className="px-3 py-2">Partner</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-right">Bonuses</th>
                  <th className="px-3 py-2 text-right">Payroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.workerProfitability.map((row) => (
                  <tr key={row.worker.id}>
                    <td className="px-3 py-3 font-semibold">
                      {row.worker.full_name ?? row.worker.email}
                    </td>
                    <td className="px-3 py-3">{row.partner?.full_name ?? "-"}</td>
                    <td className="px-3 py-3 text-right">{row.hours.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right">{row.units}</td>
                    <td className="px-3 py-3 text-right">
                      {moneyFormatter.format(row.bonuses)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {moneyFormatter.format(row.payroll)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
