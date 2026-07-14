import { Download, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import { createExpense, updateExpense } from "@/features/admin/financial-actions";
import {
  expenseCategoryLabels,
  getFinancialManagementData,
  payrollSubcategories,
  professionalServiceExamples,
  softwareExamples,
  taxExamples,
} from "@/features/admin/financial-data";
import type { FinancialExpenseCategory } from "@/types/database";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const categories = Object.entries(expenseCategoryLabels) as Array<
  [FinancialExpenseCategory, string]
>;

type ExpensesPageProps = {
  searchParams?: Promise<{
    category?: string;
    end?: string;
    partner?: string;
    q?: string;
    start?: string;
    vendor?: string;
    worker?: string;
  }>;
};

function getDateLabel(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function csvValue(value: string | number | boolean | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getCsvHref(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  const headers = [
    "Date",
    "Vendor",
    "Category",
    "Subcategory",
    "Description",
    "Amount",
    "Payment Method",
    "Paid From Account",
    "Partner",
    "Tax Deductible",
    "Recurring",
    "Notes",
  ];
  const csv = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const currentParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      currentParams.set(key, value);
    }
  });
  const currentPath = `/expenses${currentParams.toString() ? `?${currentParams.toString()}` : ""}`;
  const data = await getFinancialManagementData({
    category: params?.category,
    endDate: params?.end,
    partnerId: params?.partner,
    startDate: params?.start,
    vendor: params?.vendor,
    workerId: params?.worker,
  });
  const query = String(params?.q ?? "").trim().toLowerCase();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const workerMap = new Map(data.workers.map((worker) => [worker.id, worker]));
  const rows = data.expenses.filter((expense) => {
    const haystack =
      `${expense.vendor} ${expense.description} ${expense.subcategory ?? ""} ${expense.notes ?? ""}`.toLowerCase();

    return query ? haystack.includes(query) : true;
  });
  const categoryTotals = new Map(
    data.expenseByCategory.map((category) => [category.category, category.amount]),
  );
  const exportRows = rows.map((expense) => ({
    Amount: Number(expense.amount).toFixed(2),
    Category: expenseCategoryLabels[expense.category],
    Date: expense.expense_date,
    Description: expense.description,
    Notes: expense.notes,
    "Paid From Account": expense.paid_from_account,
    Partner: expense.partner_id ? partnerMap.get(expense.partner_id)?.full_name : "",
    "Payment Method": expense.payment_method,
    Recurring: expense.recurring,
    Subcategory: expense.subcategory,
    "Tax Deductible": expense.tax_deductible,
    Vendor: expense.vendor,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track the six SCN business expense categories with receipts, recurring costs, partner links, and tax flags."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {categories.map(([category, label]) => (
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" key={category}>
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold">
              {moneyFormatter.format(categoryTotals.get(category) ?? 0)}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <details open>
          <summary className="cursor-pointer text-base font-semibold">
            Add Expense
          </summary>
          <form
            action={createExpense}
            className="mt-4 grid gap-3 md:grid-cols-4"
            encType="multipart/form-data"
          >
            <input name="redirect_to" type="hidden" value={currentPath} />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="expense_date"
              type="date"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="vendor"
              placeholder="Vendor"
              required
            />
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="category"
            >
              {categories.map(([category, label]) => (
                <option key={category} value={category}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="subcategory"
              placeholder="Subcategory"
              list="expense-subcategories"
            />
            <datalist id="expense-subcategories">
              {[...payrollSubcategories, ...softwareExamples, ...professionalServiceExamples, ...taxExamples].map(
                (item) => (
                  <option key={item} value={item} />
                ),
              )}
            </datalist>
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
              name="description"
              placeholder="Description"
              required
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              min="0.01"
              name="amount"
              placeholder="Amount"
              required
              step="0.01"
              type="number"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="payment_method"
              placeholder="Payment method"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="paid_from_account"
              placeholder="Paid from account"
            />
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="partner_id"
            >
              <option value="">No Partner</option>
              {data.partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.full_name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="worker_id"
            >
              <option value="">No Worker</option>
              {data.workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name ?? worker.email}
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              name="receipt"
              type="file"
            />
            <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
              <input defaultChecked name="tax_deductible" type="checkbox" />
              Tax deductible
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
              <input name="recurring" type="checkbox" />
              Recurring
            </label>
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="recurring_frequency"
            >
              <option value="">Frequency</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="recurring_next_date"
              type="date"
            />
            <textarea
              className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-3"
              name="notes"
              placeholder="Notes"
            />
            <SaveSubmitButton successMessage="Expense saved.">
              Save Expense
            </SaveSubmitButton>
          </form>
        </details>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form className="grid flex-1 gap-3 md:grid-cols-6">
            <label className="text-sm font-medium md:col-span-2">
              Search
              <div className="mt-2 flex h-10 items-center rounded-md border border-border bg-background px-3">
                <Search className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  defaultValue={params?.q ?? ""}
                  name="q"
                  placeholder="Vendor, description..."
                  type="search"
                />
              </div>
            </label>
            <label className="text-sm font-medium">
              Category
              <select
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={params?.category ?? ""}
                name="category"
              >
                <option value="">All</option>
                {categories.map(([category, label]) => (
                  <option key={category} value={category}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
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
            <Button className="mt-7" type="submit">
              Filter
            </Button>
          </form>
          <div className="flex gap-2">
            <a
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold"
              download="scn-expenses.csv"
              href={getCsvHref(exportRows)}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export Excel
            </a>
            <PrintButton />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Vendor</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Partner</th>
                <th className="px-3 py-2 font-semibold">Worker</th>
                <th className="px-3 py-2 font-semibold">Receipt</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-right font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {rows.map((expense) => (
                <tr key={expense.id} className="align-top">
                  <td className="px-3 py-3">{getDateLabel(expense.expense_date)}</td>
                  <td className="px-3 py-3 font-medium">{expense.vendor}</td>
                  <td className="px-3 py-3">
                    {expenseCategoryLabels[expense.category]}
                    {expense.subcategory ? (
                      <span className="block text-xs text-muted-foreground">
                        {expense.subcategory}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{expense.description}</td>
                  <td className="px-3 py-3">
                    {expense.partner_id ? partnerMap.get(expense.partner_id)?.full_name : "-"}
                  </td>
                  <td className="px-3 py-3">
                    {expense.worker_id
                      ? workerMap.get(expense.worker_id)?.full_name ??
                        workerMap.get(expense.worker_id)?.email
                      : "-"}
                  </td>
                  <td className="px-3 py-3">
                    {expense.receipt_file_name ? expense.receipt_file_name : "-"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {moneyFormatter.format(Number(expense.amount))}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <details className="group">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-accent">
                        Edit
                      </summary>
                      <form
                        action={updateExpense}
                        className="mt-3 grid min-w-[680px] gap-3 rounded-md border border-border bg-background p-4 text-left shadow-sm md:grid-cols-4"
                        encType="multipart/form-data"
                      >
                        <input name="expense_id" type="hidden" value={expense.id} />
                        <input name="redirect_to" type="hidden" value={currentPath} />
                        <label className="text-xs font-semibold text-muted-foreground">
                          Date
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.expense_date}
                            name="expense_date"
                            type="date"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Vendor
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.vendor}
                            name="vendor"
                            required
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Category
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.category}
                            name="category"
                          >
                            {categories.map(([category, label]) => (
                              <option key={category} value={category}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Subcategory
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.subcategory ?? ""}
                            list="expense-subcategories"
                            name="subcategory"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
                          Description
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.description}
                            name="description"
                            required
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Amount
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={Number(expense.amount)}
                            min="0.01"
                            name="amount"
                            required
                            step="0.01"
                            type="number"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Payment method
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.payment_method ?? ""}
                            name="payment_method"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Paid from
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.paid_from_account ?? ""}
                            name="paid_from_account"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Partner
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.partner_id ?? ""}
                            name="partner_id"
                          >
                            <option value="">No Partner</option>
                            {data.partners.map((partner) => (
                              <option key={partner.id} value={partner.id}>
                                {partner.full_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Worker
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.worker_id ?? ""}
                            name="worker_id"
                          >
                            <option value="">No Worker</option>
                            {data.workers.map((worker) => (
                              <option key={worker.id} value={worker.id}>
                                {worker.full_name ?? worker.email}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Replace receipt
                          <input
                            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                            name="receipt"
                            type="file"
                          />
                        </label>
                        <label className="mt-6 flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground">
                          <input
                            defaultChecked={expense.tax_deductible}
                            name="tax_deductible"
                            type="checkbox"
                          />
                          Tax deductible
                        </label>
                        <label className="mt-6 flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground">
                          <input
                            defaultChecked={expense.recurring}
                            name="recurring"
                            type="checkbox"
                          />
                          Recurring
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Frequency
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.recurring_frequency ?? ""}
                            name="recurring_frequency"
                          >
                            <option value="">Frequency</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Next date
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={expense.recurring_next_date ?? ""}
                            name="recurring_next_date"
                            type="date"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground md:col-span-3">
                          Notes
                          <textarea
                            className="mt-1 min-h-16 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                            defaultValue={expense.notes ?? ""}
                            name="notes"
                          />
                        </label>
                        <SaveSubmitButton className="mt-5" successMessage="Expense changes saved.">
                          Save Changes
                        </SaveSubmitButton>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={9}>
                    No expenses found for these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
