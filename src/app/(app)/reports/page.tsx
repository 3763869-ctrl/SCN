import { Download, FileText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import {
  expenseCategoryLabels,
  getFinancialManagementData,
} from "@/features/admin/financial-data";
import { ReportCatalog } from "./report-catalog";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

type ReportsPageProps = {
  searchParams?: Promise<{
    category?: string;
    client?: string;
    end?: string;
    partner?: string;
    report?: string;
    start?: string;
    worker?: string;
  }>;
};

type ReportRow = Record<string, string | number | null | undefined>;

const reportCategories = [
  {
    id: "financial",
    title: "Financial Reports",
    reports: [
      ["profit_loss", "Profit & Loss", "Revenue, direct costs, operating expenses, and net profit."],
      ["income_statement", "Income Statement", "Income grouped by Partner, Client, and month."],
      ["expense_summary", "Expense Summary", "Expense totals by category and vendor."],
      ["cash_flow", "Cash Flow", "Cash received minus payroll, compensation, and expenses."],
      ["tax_summary", "Tax Summary", "Tax-related expenses and estimated tax reserve."],
      ["revenue_by_month", "Revenue by Month", "Monthly revenue trend from paid invoices and manual income."],
      ["revenue_by_year", "Revenue by Year", "Yearly revenue comparison."],
    ].map(([id, title, description]) => ({ description, id, title })),
  },
  {
    id: "partner",
    title: "Partner Reports",
    reports: [
      ["partner_performance", "Partner Performance", "Production, worker assignment, and revenue view by Partner."],
      ["partner_profitability", "Partner Profitability", "Revenue, worker payroll, Partner compensation, expenses, and profit."],
      ["partner_revenue", "Partner Revenue", "Income grouped by Partner."],
      ["partner_compensation", "Partner Compensation", "Partner payroll due, partial, and paid records."],
      ["outstanding_settlements", "Outstanding Settlements", "Outstanding Partner payroll balances."],
    ].map(([id, title, description]) => ({ description, id, title })),
  },
  {
    id: "worker",
    title: "Worker Reports",
    reports: [
      ["worker_payroll", "Worker Payroll", "Hours, units, bonuses, payroll, and productivity by worker."],
      ["worker_hours", "Worker Hours", "Total worker hours from completed payroll weeks."],
      ["worker_units", "Worker Units", "Units produced by worker."],
      ["worker_bonuses", "Worker Bonuses", "Bonus earnings by worker."],
      ["worker_productivity", "Worker Productivity", "Units per hour and payroll productivity."],
      ["units_per_hour", "Units Per Hour", "Worker productivity measured as units per paid hour."],
      ["payroll_history", "Payroll History", "Weekly payroll records and payment status."],
    ].map(([id, title, description]) => ({ description, id, title })),
  },
  {
    id: "invoice",
    title: "Invoice Reports",
    reports: [
      ["paid_invoices", "Paid Invoices", "Invoices fully paid by MS Support or other clients."],
      ["outstanding_invoices", "Outstanding Invoices", "Invoices with balances remaining."],
      ["overdue_invoices", "Overdue Invoices", "Open invoices past the due date."],
      ["invoice_history", "Invoice History", "All invoice activity in the selected period."],
      ["revenue_by_invoice", "Revenue by Invoice", "Invoice totals, paid amounts, and remaining balances."],
    ].map(([id, title, description]) => ({ description, id, title })),
  },
  {
    id: "expense",
    title: "Expense Reports",
    reports: [
      ["expenses_by_category", "Expenses by Category", "Spending grouped by expense category."],
      ["expenses_by_vendor", "Expenses by Vendor", "Vendor spending and payment totals."],
      ["expenses_by_partner", "Expenses by Partner", "Expenses assigned to Partners."],
      ["software_expenses", "Software Expenses", "Software tools and subscription spending."],
      ["office_expenses", "Office Expenses", "Office-related spending."],
      ["banking_fees", "Banking Fees", "Banking and payment processing fees."],
      ["professional_services", "Professional Services", "Accountant, legal, consulting, and tax preparation costs."],
      ["taxes_government", "Taxes & Government", "Taxes, business licenses, and government filing fees."],
    ].map(([id, title, description]) => ({ description, id, title })),
  },
  {
    id: "production",
    title: "Production Reports",
    reports: [
      ["units_by_day", "Units by Day", "Daily production totals from approved unit records."],
      ["units_by_week", "Units by Week", "Weekly production totals."],
      ["units_by_month", "Units by Month", "Monthly production totals."],
      ["top_workers", "Top Workers", "Workers ranked by units and productivity."],
      ["top_partners", "Top Partners", "Partners ranked by production and revenue."],
      ["production_history", "Production History", "Production totals connected to workers and Partners."],
    ].map(([id, title, description]) => ({ description, id, title })),
  },
];

const reportMap = new Map(
  reportCategories.flatMap((category) =>
    category.reports.map((report) => [report.id, { ...report, category: category.title }]),
  ),
);

function csvValue(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getReportCsvHref(rows: ReportRow[]) {
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

function amount(value: number) {
  return moneyFormatter.format(Math.round(value * 100) / 100);
}

function getMonthLabel(value: string) {
  return value;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function BarList({
  rows,
  valueKey,
}: {
  rows: ReportRow[];
  valueKey: string;
}) {
  const max = Math.max(
    1,
    ...rows.map((row) => Math.abs(Number(row[valueKey] ?? 0))).slice(0, 8),
  );

  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row, index) => {
        const value = Math.abs(Number(row[valueKey] ?? 0));
        const width = Math.max(3, Math.round((value / max) * 100));
        const label = String(row.Partner ?? row.Worker ?? row.Category ?? row.Vendor ?? row.Month ?? row.Report ?? row.Invoice ?? `Row ${index + 1}`);

        return (
          <div className="grid gap-2 text-sm" key={`${label}-${index}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{amount(Number(row[valueKey] ?? 0))}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportTable({ rows }: { rows: ReportRow[] }) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="app-table-header text-left text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th className="px-4 py-3 font-semibold" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {rows.map((row, rowIndex) => (
            <tr className="hover:bg-surface-muted/50" key={rowIndex}>
              {headers.map((header) => (
                <td className="px-4 py-3" key={header}>
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground" colSpan={headers.length || 1}>
                No records match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function withoutColumn(rows: ReportRow[], column: string) {
  return rows.map((row) => {
    const next = { ...row };
    delete next[column];

    return next;
  });
}

function getReportOutput(
  reportId: string,
  data: Awaited<ReturnType<typeof getFinancialManagementData>>,
) {
  const payrollRows = data.workerProfitability.map((row) => ({
    Bonuses: amount(row.bonuses),
    Hours: row.hours.toFixed(2),
    Payroll: amount(row.payroll),
    Partner: row.partner?.full_name ?? "-",
    Units: numberFormatter.format(row.units),
    "Units / Hour": row.hours > 0 ? (row.units / row.hours).toFixed(2) : "0.00",
    Worker: row.worker.full_name ?? row.worker.email,
  }));
  const partnerRows = data.partnerProfitability.map((row) => {
    const outstanding = data.invoices
      .filter((invoice) => invoice.partner_id === row.partner.id)
      .reduce((total, invoice) => total + Number(invoice.balance_remaining), 0);

    return {
      "Gross Profit": amount(row.grossProfit),
      "Net Profit": amount(row.netProfit),
      "Other Expenses": amount(row.assignedExpenses),
      "Outstanding Balance": amount(outstanding),
      Partner: row.partner.full_name,
      "Partner Compensation": amount(row.partnerCompensation),
      Revenue: amount(row.revenue),
      Units: numberFormatter.format(row.productionUnits),
      "Worker Payroll": amount(row.workerPayroll),
    };
  });
  const invoiceRows = data.invoices.map((invoice) => {
    const partner = data.partners.find((item) => item.id === invoice.partner_id);
    const client = data.clients.find((item) => item.id === invoice.client_id);

    return {
      Balance: amount(Number(invoice.balance_remaining)),
      Client: client?.name ?? "-",
      "Due Date": invoice.due_date,
      Invoice: invoice.invoice_number,
      Paid: amount(Number(invoice.total_paid)),
      Partner: partner?.full_name ?? "-",
      Status: invoice.status,
      Total: amount(Number(invoice.invoice_total)),
    };
  });
  const expenseRows = data.expenses.map((expense) => {
    const partner = data.partners.find((item) => item.id === expense.partner_id);

    return {
      Amount: amount(Number(expense.amount)),
      Category: expenseCategoryLabels[expense.category],
      Date: expense.expense_date,
      Description: expense.description,
      Partner: partner?.full_name ?? "-",
      Vendor: expense.vendor,
    };
  });

  if (reportId === "profit_loss") {
    const workerPayroll = data.workerPayrolls.reduce(
      (total, row) => total + Number(row.total_owed),
      0,
    );
    const bonuses = data.workerPayrolls.reduce(
      (total, row) => total + Number(row.bonus_pay),
      0,
    );
    const partnerCompensation = data.partnerPayrolls.reduce(
      (total, row) => total + Number(row.total_owed),
      0,
    );
    const operatingExpenses = data.expenseByCategory.map((row) => ({
      Amount: amount(row.amount),
      Report: row.label,
      Section: "Operating Expenses",
    }));
    const rows = [
      { Amount: amount(data.stats.totalRevenue), Report: "Revenue", Section: "Income" },
      { Amount: amount(workerPayroll), Report: "Philippines Payroll", Section: "Direct Costs" },
      { Amount: amount(partnerCompensation), Report: "Partner Compensation", Section: "Direct Costs" },
      { Amount: amount(bonuses), Report: "Bonuses", Section: "Direct Costs" },
      { Amount: amount(data.stats.grossProfit), Report: "Gross Profit", Section: "Profit" },
      ...operatingExpenses,
      { Amount: amount(data.stats.netProfit), Report: "Net Profit", Section: "Profit" },
    ];

    return {
      chartKey: "Raw Amount",
      rows: rows.map((row) => ({
        ...row,
        "Raw Amount": Number(row.Amount.replace(/[$,]/g, "")) || 0,
      })),
      summary: [
        ["Revenue", amount(data.stats.totalRevenue)],
        ["Direct Costs", amount(workerPayroll + partnerCompensation + bonuses)],
        ["Operating Expenses", amount(data.stats.totalExpenses - data.stats.payrollCosts)],
        ["Net Profit", amount(data.stats.netProfit)],
      ],
    };
  }

  if (reportId.includes("partner")) {
    return {
      chartKey: "Raw Net Profit",
      rows: partnerRows.map((row) => ({
        ...row,
        "Raw Net Profit": Number(String(row["Net Profit"]).replace(/[$,]/g, "")) || 0,
      })),
      summary: [
        ["Partners", String(partnerRows.length)],
        ["Revenue", amount(data.stats.totalRevenue)],
        ["Partner Compensation", amount(data.stats.partnerCompensation)],
        ["Net Profit", amount(data.stats.netProfit)],
      ],
    };
  }

  if (reportId.includes("worker") || reportId.includes("payroll") || reportId === "units_per_hour") {
    return {
      chartKey: "Raw Payroll",
      rows: payrollRows.map((row) => ({
        ...row,
        "Raw Payroll": Number(String(row.Payroll).replace(/[$,]/g, "")) || 0,
      })),
      summary: [
        ["Workers", String(payrollRows.length)],
        ["Payroll", amount(data.stats.payrollCosts)],
        ["Payroll Due", amount(data.stats.payrollDue)],
        ["Bonuses", amount(data.workerProfitability.reduce((total, row) => total + row.bonuses, 0))],
      ],
    };
  }

  if (reportId.includes("invoice") || reportId.includes("invoices")) {
    const filtered = reportId === "paid_invoices"
      ? invoiceRows.filter((row) => row.Status === "paid")
      : reportId === "outstanding_invoices"
        ? invoiceRows.filter((row) => row.Status !== "paid" && row.Status !== "cancelled")
        : reportId === "overdue_invoices"
          ? invoiceRows.filter((row) => row.Status === "overdue")
          : invoiceRows;

    return {
      chartKey: "Raw Total",
      rows: filtered.map((row) => ({
        ...row,
        "Raw Total": Number(String(row.Total).replace(/[$,]/g, "")) || 0,
      })),
      summary: [
        ["Invoices", String(filtered.length)],
        ["Outstanding", amount(data.stats.outstandingInvoices)],
        ["Revenue", amount(data.stats.totalRevenue)],
        ["Paid Income", amount(data.income.reduce((total, row) => total + Number(row.amount), 0))],
      ],
    };
  }

  if (reportId.includes("expense") || ["software_expenses", "office_expenses", "banking_fees", "professional_services", "taxes_government", "tax_summary"].includes(reportId)) {
    const categoryMap: Record<string, string> = {
      banking_fees: "banking_payment_fees",
      office_expenses: "office_expenses",
      professional_services: "professional_services",
      software_expenses: "software",
      taxes_government: "taxes_government",
      tax_summary: "taxes_government",
    };
    const category = categoryMap[reportId];
    const filtered = category
      ? expenseRows.filter((row) => row.Category === expenseCategoryLabels[category as keyof typeof expenseCategoryLabels])
      : expenseRows;

    return {
      chartKey: "Raw Amount",
      rows: filtered.map((row) => ({
        ...row,
        "Raw Amount": Number(String(row.Amount).replace(/[$,]/g, "")) || 0,
      })),
      summary: [
        ["Expenses", amount(data.stats.totalExpenses)],
        ["Manual Expenses", amount(data.expenses.reduce((total, row) => total + Number(row.amount), 0))],
        ["Software", amount(data.stats.softwareCosts)],
        ["Taxes", amount(data.stats.taxes)],
      ],
    };
  }

  if (reportId.includes("revenue") || reportId === "income_statement" || reportId === "cash_flow") {
    const rows = data.incomeByMonth.map((row) => ({
      Amount: amount(row.amount),
      Month: getMonthLabel(row.label),
      "Raw Amount": row.amount,
    }));

    return {
      chartKey: "Raw Amount",
      rows,
      summary: [
        ["Revenue", amount(data.stats.totalRevenue)],
        ["Cash Flow", amount(data.reports.cashFlow)],
        ["This Month", amount(data.stats.monthlyIncome)],
        ["This Year", amount(data.stats.thisYearIncome)],
      ],
    };
  }

  return {
    chartKey: "Raw Units",
    rows: data.workerProfitability.map((row) => ({
      Partner: row.partner?.full_name ?? "-",
      "Raw Units": row.units,
      Units: numberFormatter.format(row.units),
      "Units / Hour": row.hours > 0 ? (row.units / row.hours).toFixed(2) : "0.00",
      Worker: row.worker.full_name ?? row.worker.email,
    })),
    summary: [
      ["Units This Week", numberFormatter.format(data.stats.unitsThisWeek)],
      ["Units Today", numberFormatter.format(data.stats.unitsToday)],
      ["Workers", String(data.workers.length)],
      ["Partners", String(data.partners.length)],
    ],
  };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const selectedReportId = params?.report ?? "";
  const selectedReport = reportMap.get(selectedReportId);
  const data = await getFinancialManagementData({
    category: params?.category,
    clientId: params?.client,
    endDate: params?.end,
    partnerId: params?.partner,
    startDate: params?.start,
    workerId: params?.worker,
  });
  const filterParams = new URLSearchParams();

  Object.entries({
    category: params?.category,
    client: params?.client,
    end: params?.end,
    partner: params?.partner,
    start: params?.start,
    worker: params?.worker,
  }).forEach(([key, value]) => {
    if (value) {
      filterParams.set(key, value);
    }
  });

  const output = selectedReport ? getReportOutput(selectedReportId, data) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Center"
        description="Generate professional business reports from invoices, payments, payroll, production, and expenses."
      />

      <section className="app-card p-5">
        <form className="grid gap-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto] lg:items-end">
          <label className="text-sm font-medium">
            Date Range
            <input
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={params?.start ?? ""}
              name="start"
              type="date"
            />
          </label>
          <label className="text-sm font-medium">
            End Date
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
            Expense Category
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
          <label className="text-sm font-medium">
            Client
            <select
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={params?.client ?? ""}
              name="client"
            >
              <option value="">All Clients</option>
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium lg:col-span-2">
            Report Type
            <select
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={selectedReportId}
              name="report"
              required
            >
              <option value="">Choose a report</option>
              {reportCategories.map((category) => (
                <optgroup key={category.id} label={category.title}>
                  {category.reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Button className="h-10 whitespace-nowrap" type="submit">
            Generate Report
          </Button>
        </form>
      </section>

      {selectedReport && output ? (
        <section className="space-y-5">
          <div className="app-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-surface-muted text-accent">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {selectedReport.category}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">{selectedReport.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selectedReport.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold shadow-sm transition hover:bg-surface-muted"
                  download={`${selectedReport.id}.csv`}
                  href={getReportCsvHref(output.rows)}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Export Excel
                </a>
                <PrintButton label="Export PDF" />
                <PrintButton label="Print" />
              </div>
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {output.summary.map(([label, value]) => (
              <SummaryItem key={label} label={label} value={value} />
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="app-card p-5">
              <h3 className="text-base font-semibold">Chart</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Printable visual summary for this report.
              </p>
              <div className="mt-5">
                <BarList rows={output.rows} valueKey={output.chartKey} />
              </div>
            </div>

            <div className="app-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Detailed Table</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Totals and grand totals are calculated from the selected filters.
                  </p>
                </div>
                <span className="rounded-md bg-surface-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {output.rows.length} rows
                </span>
              </div>
              <ReportTable rows={withoutColumn(output.rows, output.chartKey)} />
            </div>
          </section>
        </section>
      ) : (
        <ReportCatalog
          baseParams={filterParams.toString()}
          categories={reportCategories}
        />
      )}
    </div>
  );
}
