import Link from "next/link";
import { CircleMinus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import {
  addPartnerInvoiceLine,
  deletePartnerInvoice,
  deletePartnerInvoiceLine,
  finalizePartnerInvoice,
  generatePartnerInvoices,
  markPartnerInvoiceSent,
  recordPartnerInvoicePayment,
  updatePartnerInvoiceLine,
  voidPartnerInvoicePayment,
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

type InvoicesPageProps = {
  searchParams?: Promise<{
    client?: string;
    generated?: string;
    partner?: string;
    reason?: string;
    units?: string;
  }>;
};

const invoiceGenerationReasons: Record<string, string> = {
  "existing-locked-invoice":
    "There is already a sent, paid, or otherwise locked invoice for that Partner and date range. Void or reopen it before regenerating.",
  "invalid-period": "Choose a valid invoice start and end date.",
  "invoice-save-failed": "The invoice could not be saved. Try again or contact support.",
  "missing-billing":
    "This Partner has no active billing rule. Open the Partner, go to Invoices, and save the billing rate.",
  "missing-worker-match":
    "This Partner has no assigned worker and no matching Partner worker login.",
  "no-approved-or-completed-units":
    "No approved units or completed unit periods were found in the selected date range.",
  "no-active-partners-for-client":
    "No active Partners were found for the selected client. Choose the Partner directly or check the Partner's linked client.",
  "no-matching-units":
    "Units were found in the date range, but none matched the Partner's assigned worker or matching Partner login.",
  "no-partner-selected": "Choose one Partner before generating an invoice.",
  "partner-inactive": "The selected Partner is inactive.",
  "partner-not-found":
    "The selected Partner was not found.",
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const data = await getPartnerOperationsData();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const activeBillingClientIds = new Set(
    data.billingSettings
      .filter((setting) => setting.active)
      .map((setting) => setting.client_id),
  );
  const preferredClientId =
    data.clients.find((client) =>
      data.partners.some(
        (partner) =>
          partner.client_id === client.id &&
          partner.status === "active" &&
          activeBillingClientIds.has(client.id),
      ),
    )?.id ??
    data.clients.find((client) =>
      data.partners.some(
        (partner) => partner.client_id === client.id && partner.status === "active",
      ),
    )?.id ??
    data.clients[0]?.id ??
    "";
  const clientId = data.clients.some((client) => client.id === params?.client)
    ? String(params?.client)
    : preferredClientId;
  const selectedPartnerId = data.partners.some((partner) => partner.id === params?.partner)
    ? String(params?.partner)
    : "";
  const clientName = data.clients.find((client) => client.id === clientId)?.name ?? "Client";
  const currentPeriod = getCurrentBillingPeriod();
  const generatedCount =
    params?.generated === undefined ? null : Number(params.generated);
  const generatedUnits = params?.units === undefined ? null : Number(params.units);
  const generationReasons = String(params?.reason ?? "")
    .split(",")
    .filter(Boolean)
    .map((reason) => invoiceGenerationReasons[reason] ?? reason);
  const invoiceLinesByInvoiceId = new Map<string, typeof data.invoiceLines>();
  const paymentsByInvoiceId = new Map<string, typeof data.payments>();

  for (const line of data.invoiceLines) {
    invoiceLinesByInvoiceId.set(line.invoice_id, [
      ...(invoiceLinesByInvoiceId.get(line.invoice_id) ?? []),
      line,
    ]);
  }

  for (const payment of data.payments) {
    paymentsByInvoiceId.set(payment.invoice_id, [
      ...(paymentsByInvoiceId.get(payment.invoice_id) ?? []),
      payment,
    ]);
  }

  const getInvoiceDisplayTotals = (invoice: (typeof data.invoices)[number]) => {
    const lines = invoiceLinesByInvoiceId.get(invoice.id) ?? [];
    const payments = paymentsByInvoiceId.get(invoice.id) ?? [];
    const lineUnits = lines.reduce((total, line) => total + Number(line.units), 0);
    const lineTotal = Math.round(
      lines.reduce((total, line) => total + Number(line.line_total), 0) * 100,
    ) / 100;
    const totalPaid = payments.reduce(
      (total, payment) => total + Number(payment.amount_received),
      0,
    );
    const invoiceTotal = lines.length ? lineTotal : Number(invoice.invoice_total);

    return {
      balanceRemaining: Math.max(0, invoiceTotal - totalPaid),
      invoiceTotal,
      totalPaid,
      units: lines.length ? lineUnits : Number(invoice.units),
    };
  };
  const totalOutstanding = data.invoices
    .filter((invoice) => !["paid", "cancelled"].includes(invoice.status))
    .reduce((total, invoice) => total + getInvoiceDisplayTotals(invoice).balanceRemaining, 0);
  const totalReady = data.invoices.filter((invoice) => invoice.status === "ready").length;
  const totalDraft = data.invoices.filter((invoice) => invoice.status === "draft").length;
  const totalSent = data.invoices.filter((invoice) => invoice.status === "sent").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`Generate Partner invoices for ${clientName}, mark them sent, and track payments.`}
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
        {generatedCount !== null ? (
          <div
            className={`mb-4 rounded-md border px-4 py-3 text-sm ${
              generatedCount > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {generatedCount > 0
              ? `Generated ${generatedCount} invoice preview${generatedCount === 1 ? "" : "s"} with ${generatedUnits ?? 0} approved unit${generatedUnits === 1 ? "" : "s"}.`
              : generationReasons.length
                ? generationReasons.join(" ")
                : "No invoice preview was generated. Check that this client has active Partners, active billing settings, assigned workers, and approved or completed units in this date range that were not already invoiced."}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Generate Partner Invoice</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Creates one draft invoice preview for the selected Partner using
              that Partner&apos;s units and assigned worker units.
            </p>
          </div>
          <Link className="text-sm font-semibold text-accent" href="/partners?tab=invoices">
            Set Partner rates
          </Link>
        </div>
        <form action={generatePartnerInvoices} className="mt-4 grid gap-3 md:grid-cols-7">
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Client
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              defaultValue={clientId}
              name="client_id"
              required
            >
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Partner
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              defaultValue={selectedPartnerId}
              name="partner_id"
              required
            >
              <option value="">Select Partner</option>
              {data.partners
                .filter((partner) => partner.status === "active")
                .map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {getPartnerLabel(partner)}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Period Start
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              defaultValue={currentPeriod.start}
              name="billing_period_start"
              required
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Period End
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              defaultValue={currentPeriod.end}
              name="billing_period_end"
              required
              type="date"
            />
          </label>
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2 md:mt-5"
            name="notes"
            placeholder="Run notes"
          />
          <Button className="md:mt-5" type="submit">
            Generate Preview
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Partner Invoices</h2>
        </div>
        <div className="divide-y divide-border">
          {data.invoices.map((invoice) => {
            const lines = invoiceLinesByInvoiceId.get(invoice.id) ?? [];
            const payments = paymentsByInvoiceId.get(invoice.id) ?? [];
            const displayTotals = getInvoiceDisplayTotals(invoice);
            const canEdit = ["draft", "ready"].includes(invoice.status);
            const canPay = displayTotals.balanceRemaining > 0;

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
                  <p>{displayTotals.units} units</p>
                  <div>
                    <p className="font-semibold">
                      {moneyFormatter.format(displayTotals.invoiceTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance {moneyFormatter.format(displayTotals.balanceRemaining)}
                    </p>
                  </div>
                  <span className={`h-fit w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(invoice.status)}`}>
                    {getStatusLabel(invoice.status)}
                  </span>
                </summary>
                <div className="border-t border-border bg-background px-4 py-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Invoice lines</p>
                      <div className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
                        {lines.map((line) => (
                          <div
                            className="grid gap-2 px-3 py-3 text-sm lg:grid-cols-[1fr_150px]"
                            key={line.id}
                          >
                            {canEdit ? (
                            <form
                              action={updatePartnerInvoiceLine}
                              className="grid gap-2 lg:grid-cols-[1.4fr_110px_110px_120px_auto]"
                            >
                              <input name="line_id" type="hidden" value={line.id} />
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground">
                                  Item
                                </span>
                                <input
                                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                                  defaultValue={line.description}
                                  name="description"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {line.source === "manual" ? "Manual line" : "Generated line"}
                                </p>
                              </div>
                              <input
                                defaultValue={line.work_date ?? ""}
                                name="work_date"
                                type="hidden"
                              />
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  Quantity
                                </span>
                                <input
                                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                                  defaultValue={line.units}
                                  min="0"
                                  name="units"
                                  type="number"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  Price
                                </span>
                                <input
                                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                                  defaultValue={Number(line.rate_per_unit)}
                                  min="0"
                                  name="rate_per_unit"
                                  step="0.01"
                                  type="number"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  Line Total
                                </span>
                                <input
                                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                                  defaultValue={Number(line.line_total)}
                                  min="0"
                                  name="line_total"
                                  step="0.01"
                                  type="number"
                                />
                              </label>
                              <SaveSubmitButton
                              className="mt-5 h-9 px-3"
                                successMessage="Invoice line saved."
                              >
                                Save
                              </SaveSubmitButton>
                            </form>
                            ) : (
                              <div className="grid gap-2 lg:grid-cols-[1.4fr_110px_110px_120px_auto]">
                                <div>
                                  <p className="font-semibold">{line.description}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {line.source === "manual" ? "Manual line" : "Generated line"}
                                  </p>
                                </div>
                                <span>{line.units}</span>
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
                            No invoice lines saved yet.
                          </p>
                        ) : null}
                      </div>
                      <form
                        action={addPartnerInvoiceLine}
                        className="rounded-md border border-border bg-surface p-4"
                      >
                        <h3 className="font-semibold">Add Manual Line</h3>
                        <input name="invoice_id" type="hidden" value={invoice.id} />
                        <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_100px_110px_130px_auto]">
                          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                            Item
                            <input
                              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                              name="description"
                              placeholder="Description"
                              required
                            />
                          </label>
                          <input name="work_date" type="hidden" />
                          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                            Quantity
                            <input
                              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                              min="0"
                              name="units"
                              placeholder="0"
                              step="1"
                              type="number"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                            Price
                            <input
                              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                              min="0"
                              name="rate_per_unit"
                              placeholder="0.00"
                              step="0.01"
                              type="number"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                            Line Total
                            <input
                              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                              min="0"
                              name="line_total"
                              placeholder="Optional"
                              step="0.01"
                              type="number"
                            />
                          </label>
                          <Button className="mt-5" disabled={!canEdit} type="submit">
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
                          {Number(invoice.total_paid) === 0 ? (
                            <form action={deletePartnerInvoice}>
                              <input name="invoice_id" type="hidden" value={invoice.id} />
                              <input
                                className="mb-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                                name="void_reason"
                                placeholder="Reason for voiding invoice"
                              />
                              <ConfirmSubmitButton
                                className="h-10 w-10 rounded-full border-red-200 bg-red-50 px-0 text-red-700 hover:bg-red-100"
                                confirmLabel="Void Invoice"
                                description="This hides the invoice from active screens and releases its generated units so you can regenerate it. Payments must be voided first."
                                title="Void this invoice?"
                                variant="secondary"
                              >
                                <CircleMinus className="h-5 w-5" />
                                <span className="sr-only">Void invoice</span>
                              </ConfirmSubmitButton>
                            </form>
                          ) : (
                            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                              Void all payments first before voiding this invoice.
                            </p>
                          )}
                        </div>
                      </div>
                      <form
                        action={recordPartnerInvoicePayment}
                        className="rounded-md border border-border bg-surface p-4"
                      >
                        <h3 className="font-semibold">Record {clientName} Payment</h3>
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
                      <div className="rounded-md border border-border bg-surface p-4">
                        <h3 className="font-semibold">Payment History</h3>
                        <div className="mt-3 space-y-2">
                          {payments.map((payment) => (
                            <form
                              action={voidPartnerInvoicePayment}
                              className="rounded-md border border-border bg-background p-3"
                              key={payment.id}
                            >
                              <input name="payment_id" type="hidden" value={payment.id} />
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">
                                    {moneyFormatter.format(Number(payment.amount_received))}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {getDateLabel(payment.date_received)}
                                    {payment.payment_method ? ` - ${payment.payment_method}` : ""}
                                  </p>
                                </div>
                                <ConfirmSubmitButton
                                  className="h-9 w-9 rounded-full border-red-200 bg-red-50 px-0 text-red-700 hover:bg-red-100"
                                  confirmLabel="Void Payment"
                                  description="This removes this payment from active totals and voids the connected income record."
                                  title="Void this payment?"
                                  variant="secondary"
                                >
                                  <CircleMinus className="h-4 w-4" />
                                  <span className="sr-only">Void payment</span>
                                </ConfirmSubmitButton>
                              </div>
                              <input
                                className="mt-2 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
                                name="void_reason"
                                placeholder="Reason for voiding payment"
                              />
                            </form>
                          ))}
                          {!payments.length ? (
                            <p className="text-sm text-muted-foreground">
                              No active payments recorded.
                            </p>
                          ) : null}
                        </div>
                      </div>
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
