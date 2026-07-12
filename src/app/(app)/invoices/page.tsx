import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  addPartnerInvoiceLine,
  deletePartnerInvoice,
  deletePartnerInvoiceLine,
  finalizePartnerInvoice,
  generatePartnerInvoices,
  markPartnerInvoiceSent,
  recordPartnerInvoicePayment,
  updatePartnerInvoiceLine,
} from "@/features/admin/partner-actions";
import {
  getPartnerLabel,
  getPartnerOperationsData,
  getStatusLabel,
} from "@/features/admin/partner-data";
import { getEasternDateKey } from "@/lib/dates/eastern-time";

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

function getDateLabel(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : "Not set";
}

function getCurrentBillingPeriod() {
  const today = getEasternDateKey();
  const [year, month, day] = today.split("-").map(Number);

  if (day <= 15) {
    return {
      end: `${year}-${String(month).padStart(2, "0")}-15`,
      start: `${year}-${String(month).padStart(2, "0")}-01`,
    };
  }

  const endOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  return {
    end: endOfMonth,
    start: `${year}-${String(month).padStart(2, "0")}-16`,
  };
}

function statusClass(status: string) {
  if (status === "paid" || status === "closed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "sent") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (status === "overdue" || status === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-orange-200 bg-orange-50 text-orange-800";
}

export default async function InvoicesPage() {
  const data = await getPartnerOperationsData();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const clientId = data.clients[0]?.id ?? "";
  const currentPeriod = getCurrentBillingPeriod();
  const totalOutstanding = data.invoices
    .filter((invoice) => !["paid", "cancelled"].includes(invoice.status))
    .reduce(
      (total, invoice) =>
        total + Number(invoice.balance_remaining ?? invoice.invoice_total),
      0,
    );
  const totalReady = data.invoices.filter((invoice) => invoice.status === "ready").length;
  const totalDraft = data.invoices.filter((invoice) => invoice.status === "draft").length;
  const totalSent = data.invoices.filter((invoice) => invoice.status === "sent").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Generate Partner invoices for MS Support, mark them sent, and track payments."
      />

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          ["Preview Drafts", totalDraft],
          ["Ready", totalReady],
          ["Waiting Payment", totalSent],
          ["Outstanding", moneyFormatter.format(totalOutstanding)],
        ].map(([label, value]) => (
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Generate MS Support Invoices</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Creates draft invoice previews per active Partner using approved
              worker units and the Partner rate per unit.
            </p>
          </div>
          <Link className="text-sm font-semibold text-accent" href="/partners?tab=invoices">
            Set Partner rates
          </Link>
        </div>
        <form action={generatePartnerInvoices} className="mt-4 grid gap-3 md:grid-cols-5">
          <input name="client_id" type="hidden" value={clientId} />
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            defaultValue={currentPeriod.start}
            name="billing_period_start"
            required
            type="date"
          />
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            defaultValue={currentPeriod.end}
            name="billing_period_end"
            required
            type="date"
          />
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
            name="notes"
            placeholder="Run notes"
          />
          <Button type="submit">Generate Preview</Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Partner Invoices</h2>
        </div>
        <div className="divide-y divide-border">
          {data.invoices.map((invoice) => {
            const lines = data.invoiceLines.filter((line) => line.invoice_id === invoice.id);
            const canEdit = ["draft", "ready"].includes(invoice.status);
            const canPay = Number(invoice.balance_remaining ?? invoice.invoice_total) > 0;

            return (
              <details className="group" key={invoice.id}>
                <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto]">
                  <div>
                    <Link
                      className="font-semibold text-accent"
                      href={`/invoices/${invoice.id}/print`}
                      target="_blank"
                    >
                      {invoice.invoice_number}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getPartnerLabel(partnerMap.get(invoice.partner_id))}
                    </p>
                  </div>
                  <p>
                    {getDateLabel(invoice.billing_period_start)} -{" "}
                    {getDateLabel(invoice.billing_period_end)}
                  </p>
                  <p>{invoice.units} units</p>
                  <div>
                    <p className="font-semibold">
                      {moneyFormatter.format(Number(invoice.invoice_total))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance{" "}
                      {moneyFormatter.format(
                        Number(invoice.balance_remaining ?? invoice.invoice_total),
                      )}
                    </p>
                  </div>
                  <span className={`h-fit w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(invoice.status)}`}>
                    {getStatusLabel(invoice.status)}
                  </span>
                </summary>
                <div className="border-t border-border bg-background px-4 py-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Invoice details</p>
                      <div className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
                        {lines.map((line) => (
                          <div
                            className="grid gap-2 px-3 py-3 text-sm lg:grid-cols-[1fr_150px]"
                            key={line.id}
                          >
                            {canEdit ? (
                            <form
                              action={updatePartnerInvoiceLine}
                              className="grid gap-2 lg:grid-cols-[1.3fr_120px_90px_100px_110px_auto]"
                            >
                              <input name="line_id" type="hidden" value={line.id} />
                              <div>
                                <input
                                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                                  defaultValue={line.description}
                                  name="description"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {line.source === "manual" ? "Manual line" : "Generated line"}
                                </p>
                              </div>
                              <input
                                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                                defaultValue={line.work_date ?? ""}
                                name="work_date"
                                type="date"
                              />
                              <input
                                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                                defaultValue={line.units}
                                min="0"
                                name="units"
                                type="number"
                              />
                              <input
                                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                                defaultValue={Number(line.rate_per_unit)}
                                min="0"
                                name="rate_per_unit"
                                step="0.01"
                                type="number"
                              />
                              <input
                                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                                defaultValue={Number(line.line_total)}
                                min="0"
                                name="line_total"
                                step="0.01"
                                type="number"
                              />
                              <Button className="h-9 px-3" type="submit">
                                Save
                              </Button>
                            </form>
                            ) : (
                              <div className="grid gap-2 lg:grid-cols-[1.3fr_120px_90px_100px_110px_auto]">
                                <div>
                                  <p className="font-semibold">{line.description}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {line.source === "manual" ? "Manual line" : "Generated line"}
                                  </p>
                                </div>
                                <span>{getDateLabel(line.work_date)}</span>
                                <span>{line.units} units</span>
                                <span>{moneyFormatter.format(Number(line.rate_per_unit))}</span>
                                <span>{moneyFormatter.format(Number(line.line_total))}</span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                  Locked
                                </span>
                              </div>
                            )}
                            {canEdit ? (
                            <form action={deletePartnerInvoiceLine}>
                              <input name="line_id" type="hidden" value={line.id} />
                              <ConfirmSubmitButton
                                className="h-9 w-full px-3"
                                confirmLabel="Delete Line"
                                description="This removes this invoice line and recalculates the invoice total."
                                title="Delete invoice line?"
                                variant="secondary"
                              >
                                Delete
                              </ConfirmSubmitButton>
                            </form>
                            ) : null}
                          </div>
                        ))}
                        {!lines.length ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            No daily lines saved for this invoice.
                          </p>
                        ) : null}
                      </div>
                      <form
                        action={addPartnerInvoiceLine}
                        className="rounded-md border border-border bg-surface p-4"
                      >
                        <h3 className="font-semibold">Add Manual Line</h3>
                        <input name="invoice_id" type="hidden" value={invoice.id} />
                        <div className="mt-3 grid gap-3 md:grid-cols-5">
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
                            name="description"
                            placeholder="Description"
                            required
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                            name="work_date"
                            type="date"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                            min="0"
                            name="units"
                            placeholder="Units"
                            step="1"
                            type="number"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                            min="0"
                            name="rate_per_unit"
                            placeholder="Rate"
                            step="0.01"
                            type="number"
                          />
                          <input
                            className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-4"
                            min="0"
                            name="line_total"
                            placeholder="Line total override"
                            step="0.01"
                            type="number"
                          />
                          <Button disabled={!canEdit} type="submit">
                            Add Line
                          </Button>
                        </div>
                        {!canEdit ? (
                          <p className="mt-3 text-xs font-semibold text-muted-foreground">
                            Sent and paid invoices are locked.
                          </p>
                        ) : null}
                      </form>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-md border border-border bg-surface p-4">
                        <h3 className="font-semibold">Invoice Actions</h3>
                        <div className="mt-3 grid gap-2">
                          {invoice.status === "draft" ? (
                            <form action={finalizePartnerInvoice}>
                              <input name="invoice_id" type="hidden" value={invoice.id} />
                              <Button className="w-full" type="submit">
                                Run Invoice
                              </Button>
                            </form>
                          ) : null}
                          {invoice.status === "ready" ? (
                            <form action={markPartnerInvoiceSent}>
                              <input name="invoice_id" type="hidden" value={invoice.id} />
                              <Button className="w-full" type="submit">
                                Mark Sent
                              </Button>
                            </form>
                          ) : null}
                          <Link
                            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold"
                            href={`/invoices/${invoice.id}/print`}
                            target="_blank"
                          >
                            Open Invoice / Pay
                          </Link>
                          {["draft", "ready"].includes(invoice.status) &&
                          Number(invoice.total_paid) === 0 ? (
                            <form action={deletePartnerInvoice}>
                              <input name="invoice_id" type="hidden" value={invoice.id} />
                              <ConfirmSubmitButton
                                className="w-full"
                                confirmLabel="Delete Invoice"
                                description="This deletes this draft invoice and its lines. You can regenerate it again from approved units."
                                title="Delete this invoice?"
                                variant="secondary"
                              >
                                Delete Invoice
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      <form
                        action={recordPartnerInvoicePayment}
                        className="rounded-md border border-border bg-surface p-4"
                      >
                        <h3 className="font-semibold">Record MS Support Payment</h3>
                        <input name="invoice_id" type="hidden" value={invoice.id} />
                        {!canPay ? (
                          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                            This invoice is fully paid.
                          </p>
                        ) : (
                        <div className="mt-3 space-y-3">
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                          min="0"
                          name="amount_received"
                          placeholder="Amount received"
                          required
                          step="0.01"
                          type="number"
                        />
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                          name="date_received"
                          type="date"
                        />
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                          name="payment_method"
                          placeholder="Payment method"
                        />
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                          name="deposit_account"
                          placeholder="Deposit account"
                        />
                        <textarea
                          className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          name="notes"
                          placeholder="Notes"
                        />
                        <Button className="w-full" type="submit">
                          Record Payment
                        </Button>
                        </div>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
          {!data.invoices.length ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              No Partner invoices created yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
