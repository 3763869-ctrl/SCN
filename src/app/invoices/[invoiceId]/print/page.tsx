import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { recordPartnerInvoicePayment } from "@/features/admin/partner-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PrintButton } from "./print-button";

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

type PrintInvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
};

function getDateLabel(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : "";
}

export default async function PrintInvoicePage({ params }: PrintInvoicePageProps) {
  const { invoiceId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select(
      "id, invoice_number, billing_period_start, billing_period_end, units, rate_per_unit, invoice_total, total_paid, balance_remaining, due_date, status, partner_id, client_id",
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    notFound();
  }

  const [{ data: partner }, { data: client }, { data: lines }] = await Promise.all([
    supabase
      .from("partners")
      .select("full_name, email, phone")
      .eq("id", invoice.partner_id)
      .single(),
    supabase.from("clients").select("name").eq("id", invoice.client_id).single(),
    supabase
      .from("partner_invoice_lines")
      .select("id, description, work_date, units, rate_per_unit, line_total")
      .eq("invoice_id", invoice.id)
      .order("work_date", { ascending: true }),
  ]);
  const balanceRemaining = Number(invoice.balance_remaining ?? invoice.invoice_total);

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950 print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden">
          {balanceRemaining > 0 ? (
            <form
              action={recordPartnerInvoicePayment}
              className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
            >
              <input name="invoice_id" type="hidden" value={invoice.id} />
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                max={balanceRemaining}
                min="0"
                name="amount_received"
                placeholder="Payment amount"
                required
                step="0.01"
                type="number"
              />
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                name="date_received"
                type="date"
              />
              <Button type="submit">Pay Invoice</Button>
            </form>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              Paid in full
            </div>
          )}
          <PrintButton />
        </div>

        <section className="bg-white p-8 print:p-0">
          <div className="flex flex-col gap-8 border-b border-slate-300 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Invoice</h1>
              <p className="mt-2 text-lg font-semibold">{invoice.invoice_number}</p>
              <p className="mt-1 text-sm text-slate-600">
                Billing Period: {getDateLabel(invoice.billing_period_start)} -{" "}
                {getDateLabel(invoice.billing_period_end)}
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p>
                <span className="font-semibold">Due:</span>{" "}
                {getDateLabel(invoice.due_date) || "Not set"}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {invoice.status}
              </p>
            </div>
          </div>

          <div className="grid gap-8 border-b border-slate-200 py-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                From
              </p>
              <p className="mt-2 text-xl font-bold">{partner?.full_name ?? "Partner"}</p>
              <p className="text-sm text-slate-700">{partner?.email}</p>
              <p className="text-sm text-slate-700">{partner?.phone}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Bill To
              </p>
              <p className="mt-2 text-xl font-bold">{client?.name ?? "MS Support"}</p>
            </div>
          </div>

          <table className="mt-8 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-3 pr-3">Description</th>
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3 text-right">Units</th>
                <th className="py-3 pr-3 text-right">Rate</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((line) => (
                <tr className="border-b border-slate-100" key={line.id}>
                  <td className="py-3 pr-3">{line.description}</td>
                  <td className="py-3 pr-3">{getDateLabel(line.work_date)}</td>
                  <td className="py-3 pr-3 text-right">{line.units}</td>
                  <td className="py-3 pr-3 text-right">
                    {moneyFormatter.format(Number(line.rate_per_unit))}
                  </td>
                  <td className="py-3 text-right">
                    {moneyFormatter.format(Number(line.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-sm space-y-3 border-t border-slate-300 pt-4 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-semibold">
                  {moneyFormatter.format(Number(invoice.invoice_total))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span>{moneyFormatter.format(Number(invoice.total_paid))}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Balance</span>
                <span>{moneyFormatter.format(balanceRemaining)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
