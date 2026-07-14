import Link from "next/link";
import { Download, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/ui/print-button";
import { Button } from "@/components/ui/button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import { createManualIncome, updateIncome } from "@/features/admin/financial-actions";
import { getFinancialManagementData } from "@/features/admin/financial-data";

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

type IncomePageProps = {
  searchParams?: Promise<{
    client?: string;
    end?: string;
    partner?: string;
    q?: string;
    start?: string;
  }>;
};

function getDateLabel(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function csvValue(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getCsvHref(rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = [
    "Date",
    "Partner",
    "Client",
    "Invoice",
    "Source",
    "Payment Method",
    "Deposit Account",
    "Amount",
    "Notes",
  ];
  const csv = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export default async function IncomePage({ searchParams }: IncomePageProps) {
  const params = await searchParams;
  const currentParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      currentParams.set(key, value);
    }
  });
  const currentPath = `/income${currentParams.toString() ? `?${currentParams.toString()}` : ""}`;
  const data = await getFinancialManagementData({
    clientId: params?.client,
    endDate: params?.end,
    partnerId: params?.partner,
    startDate: params?.start,
  });
  const query = String(params?.q ?? "").trim().toLowerCase();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const clientMap = new Map(data.clients.map((client) => [client.id, client]));
  const rows = data.income.filter((record) => {
    const partner = record.partner_id ? partnerMap.get(record.partner_id)?.full_name : "";
    const client = record.client_id ? clientMap.get(record.client_id)?.name : "";
    const haystack =
      `${partner ?? ""} ${client ?? ""} ${record.invoice_number ?? ""} ${record.payment_method ?? ""} ${record.deposit_account ?? ""} ${record.notes ?? ""}`.toLowerCase();

    return query ? haystack.includes(query) : true;
  });
  const exportRows = rows.map((record) => ({
    Amount: Number(record.amount).toFixed(2),
    Client: record.client_id ? clientMap.get(record.client_id)?.name : "Manual",
    Date: record.income_date,
    "Deposit Account": record.deposit_account,
    Invoice: record.invoice_number,
    Notes: record.notes,
    Partner: record.partner_id ? partnerMap.get(record.partner_id)?.full_name : "Manual",
    "Payment Method": record.payment_method,
    Source: record.source === "invoice_payment" ? "Invoice payment" : "Manual income",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        description="Income is created automatically from paid Partner invoices, with manual income available for outside deposits."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Today", data.stats.todayIncome],
          ["This Week", data.stats.thisWeekIncome],
          ["This Month", data.stats.monthlyIncome],
          ["This Year", data.stats.thisYearIncome],
          ["Lifetime", data.stats.lifetimeIncome],
        ].map(([label, value]) => (
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" key={label}>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {moneyFormatter.format(Number(value))}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <details>
          <summary className="cursor-pointer text-base font-semibold">
            Add Manual Income
          </summary>
          <form action={createManualIncome} className="mt-4 grid gap-3 md:grid-cols-4">
            <input name="redirect_to" type="hidden" value={currentPath} />
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
              name="client_id"
            >
              <option value="">No Client</option>
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="income_date"
              type="date"
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
              name="invoice_number"
              placeholder="Reference or invoice number"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="payment_method"
              placeholder="Payment method"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="deposit_account"
              placeholder="Deposit account"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="notes"
              placeholder="Notes"
            />
            <SaveSubmitButton className="md:col-span-4" successMessage="Manual income saved.">
              Save Manual Income
            </SaveSubmitButton>
          </form>
        </details>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form className="grid flex-1 gap-3 md:grid-cols-5">
            <label className="text-sm font-medium">
              Search
              <div className="mt-2 flex h-10 items-center rounded-md border border-border bg-background px-3">
                <Search className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  defaultValue={params?.q ?? ""}
                  name="q"
                  placeholder="Partner, client, invoice..."
                  type="search"
                />
              </div>
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
            <Button className="mt-7" type="submit">
              Filter
            </Button>
          </form>
          <div className="flex gap-2">
            <a
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold"
              download="scn-income.csv"
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
                <th className="px-3 py-2 font-semibold">Partner</th>
                <th className="px-3 py-2 font-semibold">Client</th>
                <th className="px-3 py-2 font-semibold">Invoice</th>
                <th className="px-3 py-2 font-semibold">Method</th>
                <th className="px-3 py-2 font-semibold">Deposit</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-right font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {rows.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="px-3 py-3">{getDateLabel(record.income_date)}</td>
                  <td className="px-3 py-3">
                    {record.partner_id
                      ? partnerMap.get(record.partner_id)?.full_name
                      : "Manual"}
                  </td>
                  <td className="px-3 py-3">
                    {record.client_id ? clientMap.get(record.client_id)?.name : "Manual"}
                  </td>
                  <td className="px-3 py-3">
                    {record.invoice_id ? (
                      <Link
                        className="font-semibold text-accent"
                        href={`/invoices/${record.invoice_id}/print`}
                        target="_blank"
                      >
                        {record.invoice_number}
                      </Link>
                    ) : (
                      record.invoice_number ?? "-"
                    )}
                  </td>
                  <td className="px-3 py-3">{record.payment_method ?? "-"}</td>
                  <td className="px-3 py-3">{record.deposit_account ?? "-"}</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {moneyFormatter.format(Number(record.amount))}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <details>
                      <summary className="cursor-pointer list-none text-sm font-semibold text-accent">
                        Edit
                      </summary>
                      <form
                        action={updateIncome}
                        className="mt-3 grid min-w-[620px] gap-3 rounded-md border border-border bg-background p-4 text-left shadow-sm md:grid-cols-4"
                      >
                        <input name="income_id" type="hidden" value={record.id} />
                        <input name="redirect_to" type="hidden" value={currentPath} />
                        <label className="text-xs font-semibold text-muted-foreground">
                          Partner
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.partner_id ?? ""}
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
                          Client
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.client_id ?? ""}
                            name="client_id"
                          >
                            <option value="">No Client</option>
                            {data.clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Date
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.income_date}
                            name="income_date"
                            type="date"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Amount
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={Number(record.amount)}
                            min="0.01"
                            name="amount"
                            required
                            step="0.01"
                            type="number"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Invoice / Reference
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.invoice_number ?? ""}
                            name="invoice_number"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Payment method
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.payment_method ?? ""}
                            name="payment_method"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Deposit account
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.deposit_account ?? ""}
                            name="deposit_account"
                          />
                        </label>
                        <label className="text-xs font-semibold text-muted-foreground md:col-span-3">
                          Notes
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                            defaultValue={record.notes ?? ""}
                            name="notes"
                          />
                        </label>
                        <SaveSubmitButton className="mt-5" successMessage="Income changes saved.">
                          Save Changes
                        </SaveSubmitButton>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                    No income found for these filters.
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
