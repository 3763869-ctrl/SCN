import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { recordPartnerPayrollPayment } from "@/features/admin/partner-actions";
import {
  getPartnerLabel,
  getPartnerOperationsData,
  getStatusLabel,
} from "@/features/admin/partner-data";

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

function getStatusClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-orange-200 bg-orange-50 text-orange-800";
}

export default async function PartnerPayrollPage() {
  const data = await getPartnerOperationsData();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const invoiceMap = new Map(data.invoices.map((invoice) => [invoice.id, invoice]));
  const dueRecords = data.partnerPayrolls.filter((payroll) =>
    ["due", "partial"].includes(payroll.status),
  );
  const paidRecords = data.partnerPayrolls.filter((payroll) => payroll.status === "paid");
  const dueTotal = dueRecords.reduce(
    (total, payroll) => total + Number(payroll.balance_remaining),
    0,
  );
  const paidTotal = paidRecords.reduce(
    (total, payroll) => total + Number(payroll.total_paid),
    0,
  );

  const renderPayrollRecord = (
    payroll: (typeof data.partnerPayrolls)[number],
    showPaymentForm: boolean,
  ) => {
    const invoice = payroll.invoice_id ? invoiceMap.get(payroll.invoice_id) : null;

    return (
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm" key={payroll.id}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{getPartnerLabel(partnerMap.get(payroll.partner_id))}</h3>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(payroll.status)}`}>
                {getStatusLabel(payroll.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Invoice {invoice?.invoice_number ?? "not linked"} ·{" "}
              {getDateLabel(payroll.billing_period_start)} -{" "}
              {getDateLabel(payroll.billing_period_end)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rule: {getStatusLabel(payroll.pay_type_snapshot)} · Flat{" "}
              {moneyFormatter.format(Number(payroll.flat_pay_snapshot))} ·{" "}
              {Number(payroll.invoice_percentage_snapshot).toFixed(2)}%
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold text-muted-foreground">Owed</p>
              <p className="mt-1 font-semibold">{moneyFormatter.format(Number(payroll.total_owed))}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold text-muted-foreground">Paid</p>
              <p className="mt-1 font-semibold">{moneyFormatter.format(Number(payroll.total_paid))}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold text-muted-foreground">Balance</p>
              <p className="mt-1 font-semibold">
                {moneyFormatter.format(Number(payroll.balance_remaining))}
              </p>
            </div>
          </div>
        </div>
        {showPaymentForm ? (
          <form action={recordPartnerPayrollPayment} className="mt-4 grid gap-3 md:grid-cols-4">
            <input name="partner_payroll_id" type="hidden" value={payroll.id} />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              max={Number(payroll.balance_remaining)}
              min="0"
              name="amount"
              placeholder="Amount paid"
              required
              step="0.01"
              type="number"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="paid_at"
              type="date"
            />
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              name="notes"
              placeholder="Notes"
            />
            <Button type="submit">Record Payment</Button>
          </form>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner Payroll"
        description="Flat Partner payroll created when client invoices are run."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Due / Partial</p>
          <p className="mt-2 text-2xl font-semibold">{dueRecords.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Balance Due</p>
          <p className="mt-2 text-2xl font-semibold">{moneyFormatter.format(dueTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Paid History</p>
          <p className="mt-2 text-2xl font-semibold">{moneyFormatter.format(paidTotal)}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Due and Partial</h2>
        {dueRecords.map((payroll) => renderPayrollRecord(payroll, true))}
        {!dueRecords.length ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            No Partner payroll is due right now.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Paid History</h2>
        {paidRecords.map((payroll) => renderPayrollRecord(payroll, false))}
        {!paidRecords.length ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            No paid Partner payroll history yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
