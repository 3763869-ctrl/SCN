import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { recordPartnerInvoicePayment } from "@/features/admin/partner-actions";
import { formatInvoiceNumber } from "@/lib/format/invoice";
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

export async function generateMetadata({
  params,
}: PrintInvoicePageProps): Promise<Metadata> {
  const { invoiceId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  return {
    title: invoice?.invoice_number
      ? `Invoice ${formatInvoiceNumber(invoice.invoice_number)}`
      : "Invoice",
  };
}

function getDateLabel(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : "";
}

function getAddressLines(
  entity:
    | {
        address_line1?: string | null;
        address_line2?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        zip_code?: string | null;
      }
    | null
    | undefined,
) {
  const cityStateZip = [entity?.city, entity?.state, entity?.zip_code]
    .filter(Boolean)
    .join(", ");

  return [
    entity?.address_line1,
    entity?.address_line2,
    cityStateZip,
    entity?.country,
  ].filter(Boolean);
}

export default async function PrintInvoicePage({ params }: PrintInvoicePageProps) {
  const { invoiceId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select(
      "id, invoice_number, billing_period_start, billing_period_end, units, rate_per_unit, invoice_total, total_paid, balance_remaining, due_date, partner_id, client_id",
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    notFound();
  }

  const extendedPartner = await supabase
    .from("partners")
    .select(
      "full_name, email, phone, address_line1, address_line2, city, state, country, zip_code, bank_name, bank_account_holder_name, bank_account_number, bank_routing_number, invoice_notes, notes",
    )
    .eq("id", invoice.partner_id)
    .single();
  const partnerResult = extendedPartner.error
    ? await supabase
        .from("partners")
        .select("full_name, email, phone, notes")
        .eq("id", invoice.partner_id)
        .single()
    : extendedPartner;
  const extendedClient = await supabase
    .from("clients")
    .select("name, email, phone, address_line1, address_line2, city, state, country, zip_code")
    .eq("id", invoice.client_id)
    .single();
  const clientResult = extendedClient.error
    ? await supabase.from("clients").select("name").eq("id", invoice.client_id).single()
    : extendedClient;
  const { data: lines } = await supabase
    .from("partner_invoice_lines")
    .select("id, description, work_date, units, rate_per_unit, line_total")
    .eq("invoice_id", invoice.id)
    .order("work_date", { ascending: true });
  const partner = partnerResult.data as
    | (NonNullable<typeof partnerResult.data> & {
        address_line1?: string | null;
        address_line2?: string | null;
        bank_account_holder_name?: string | null;
        bank_account_number?: string | null;
        bank_name?: string | null;
        bank_routing_number?: string | null;
        city?: string | null;
        country?: string | null;
        invoice_notes?: string | null;
        state?: string | null;
        zip_code?: string | null;
      })
    | null;
  const partnerAddress = getAddressLines(partner);
  const client = clientResult.data as
    | (NonNullable<typeof clientResult.data> & {
        address_line1?: string | null;
        address_line2?: string | null;
        city?: string | null;
        country?: string | null;
        email?: string | null;
        phone?: string | null;
        state?: string | null;
        zip_code?: string | null;
      })
    | null;
  const clientAddress = getAddressLines(client);
  const lineInvoiceTotal = Math.round(
    (lines ?? []).reduce((total, line) => total + Number(line.line_total), 0) * 100,
  ) / 100;
  const invoiceTotal = (lines ?? []).length ? lineInvoiceTotal : Number(invoice.invoice_total);
  const totalPaid = Number(invoice.total_paid);
  const displayBalance = Math.max(0, invoiceTotal - totalPaid);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 print:bg-white print:p-0">
      <style media="print">{`
        @page {
          margin: 0.4in;
        }
      `}</style>
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden">
          {displayBalance > 0 ? (
            <form
              action={recordPartnerInvoicePayment}
              className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
            >
              <input name="invoice_id" type="hidden" value={invoice.id} />
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                max={displayBalance}
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

        <section className="bg-white p-8 shadow-sm print:p-0 print:shadow-none">
          <div className="flex flex-col gap-8 border-b-2 border-slate-900 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold uppercase tracking-tight">Invoice</h1>
              <p className="mt-4 text-2xl font-bold">
                {partner?.full_name ?? "Partner"}
              </p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>{partner?.email}</p>
                <p>{partner?.phone}</p>
                {partnerAddress.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="min-w-56 text-sm sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Invoice Number
              </p>
              <p className="text-lg font-bold">{formatInvoiceNumber(invoice.invoice_number)}</p>
              <dl className="mt-4 space-y-2">
                <div>
                  <dt className="font-semibold">Period</dt>
                  <dd>
                    {getDateLabel(invoice.billing_period_start)} -{" "}
                    {getDateLabel(invoice.billing_period_end)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Due Date</dt>
                  <dd>{getDateLabel(invoice.due_date) || "Not set"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-8 border-b border-slate-200 py-8 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Bill To
              </p>
              <p className="mt-2 text-xl font-bold">{client?.name ?? "Client"}</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                {client?.email ? <p>{client.email}</p> : null}
                {client?.phone ? <p>{client.phone}</p> : null}
                {clientAddress.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Payment Information
              </p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Bank:</span>{" "}
                  {partner?.bank_name || "Not provided"}
                </p>
                <p>
                  <span className="font-semibold">Name on account:</span>{" "}
                  {partner?.bank_account_holder_name || partner?.full_name || "Not provided"}
                </p>
                <p>
                  <span className="font-semibold">Account:</span>{" "}
                  {partner?.bank_account_number || "Not provided"}
                </p>
                <p>
                  <span className="font-semibold">Routing:</span>{" "}
                  {partner?.bank_routing_number || "Not provided"}
                </p>
              </div>
            </div>
          </div>

          <table className="mt-8 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3 text-right">Quantity</th>
                <th className="px-3 py-3 text-right">Price</th>
                <th className="px-3 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((line, index) => (
                <tr
                  className={`border-b border-slate-100 ${
                    index % 2 === 1 ? "bg-slate-50" : "bg-white"
                  }`}
                  key={line.id}
                >
                  <td className="px-3 py-3">{line.description}</td>
                  <td className="px-3 py-3 text-right">{line.units}</td>
                  <td className="px-3 py-3 text-right">
                    {moneyFormatter.format(Number(line.rate_per_unit))}
                  </td>
                  <td className="px-3 py-3 text-right">
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
                  {moneyFormatter.format(invoiceTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span>{moneyFormatter.format(totalPaid)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Balance</span>
                <span>{moneyFormatter.format(displayBalance)}</span>
              </div>
            </div>
          </div>

          {partner?.invoice_notes || partner?.notes ? (
            <div className="mt-8 rounded-md border border-slate-200 p-4 text-sm">
              <p className="font-bold">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">
                {partner.invoice_notes || partner.notes}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
