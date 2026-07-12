import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { getPartnerLabel, getPartnerOperationsData, getStatusLabel } from "@/features/admin/partner-data";

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

export default async function InvoicesPage() {
  const data = await getPartnerOperationsData();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const totalOutstanding = data.invoices
    .filter((invoice) => !["paid", "cancelled"].includes(invoice.status))
    .reduce((total, invoice) => total + Number(invoice.invoice_total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Partner invoices to MS Support, grouped across all Partners."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Invoices</p>
          <p className="mt-2 text-2xl font-semibold">{data.invoices.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold">
            {moneyFormatter.format(totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Paid Payments</p>
          <p className="mt-2 text-2xl font-semibold">{data.payments.length}</p>
        </div>
      </section>

      <section className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
        {data.invoices.map((invoice) => (
          <div className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_1fr_1fr_auto]" key={invoice.id}>
            <div>
              <p className="font-semibold">{invoice.invoice_number}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {getPartnerLabel(partnerMap.get(invoice.partner_id))}
              </p>
            </div>
            <p>{getDateLabel(invoice.billing_period_start)} - {getDateLabel(invoice.billing_period_end)}</p>
            <p>{invoice.units} units</p>
            <p className="font-semibold">{moneyFormatter.format(Number(invoice.invoice_total))}</p>
            <Link
              className="font-semibold text-accent"
              href={`/partners?partner=${invoice.partner_id}&tab=invoices`}
            >
              {getStatusLabel(invoice.status)}
            </Link>
          </div>
        ))}
        {!data.invoices.length ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No Partner invoices created yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
