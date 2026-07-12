import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { getPartnerLabel, getPartnerOperationsData } from "@/features/admin/partner-data";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function getDateLabel(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "Not set";
}

export default async function DocumentsPage() {
  const data = await getPartnerOperationsData();
  const partnerMap = new Map(data.partners.map((partner) => [partner.id, partner]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Partner invoices, agreements, and other business files."
      />

      <section className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
        {data.documents.map((document) => (
          <div
            className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_1fr_auto]"
            key={document.id}
          >
            <div>
              <p className="font-semibold">{document.file_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {document.document_type || "Document"}
              </p>
            </div>
            <p>{getPartnerLabel(partnerMap.get(document.partner_id))}</p>
            <p>{getDateLabel(document.created_at)}</p>
            <Link
              className="font-semibold text-accent"
              href={`/partners?partner=${document.partner_id}&tab=documents`}
            >
              View Partner
            </Link>
          </div>
        ))}
        {!data.documents.length ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No Partner documents uploaded yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
