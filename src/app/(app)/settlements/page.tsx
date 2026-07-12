import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
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

export default async function SettlementsPage() {
  const data = await getPartnerOperationsData();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));
  const outstanding = data.settlements
    .filter(
      (settlement) =>
        !["transferred", "waived", "cancelled"].includes(settlement.transfer_status),
    )
    .reduce(
      (total, settlement) =>
        total +
        Math.max(
          0,
          Number(settlement.amount_received_by_partner) -
            Number(settlement.amount_partner_keeps) -
            Number(settlement.amount_transferred_to_scn),
        ),
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlements"
        description="Track Partner-to-SCN transfer status after MS Support pays."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Settlements</p>
          <p className="mt-2 text-2xl font-semibold">{data.settlements.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold">
            {moneyFormatter.format(outstanding)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Transferred to SCN</p>
          <p className="mt-2 text-2xl font-semibold">
            {moneyFormatter.format(
              data.settlements.reduce(
                (total, settlement) =>
                  total + Number(settlement.amount_transferred_to_scn),
                0,
              ),
            )}
          </p>
        </div>
      </section>

      <section className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
        {data.settlements.map((settlement) => (
          <div
            className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
            key={settlement.id}
          >
            <div>
              <p className="font-semibold">
                {getPartnerLabel(partnerMap.get(settlement.partner_id))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Transfer date: {getDateLabel(settlement.transfer_date)}
              </p>
            </div>
            <p>
              Received:{" "}
              {moneyFormatter.format(Number(settlement.amount_received_by_partner))}
            </p>
            <p>
              Keeps: {moneyFormatter.format(Number(settlement.amount_partner_keeps))}
            </p>
            <p>
              To SCN:{" "}
              {moneyFormatter.format(Number(settlement.amount_transferred_to_scn))}
            </p>
            <Link
              className="font-semibold text-accent"
              href={`/partners?partner=${settlement.partner_id}&tab=settlements`}
            >
              {getStatusLabel(settlement.transfer_status)}
            </Link>
          </div>
        ))}
        {!data.settlements.length ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No settlements recorded yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
