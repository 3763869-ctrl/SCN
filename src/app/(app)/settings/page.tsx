import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { getPartnerOperationsData, getStatusLabel } from "@/features/admin/partner-data";

export default async function SettingsPage() {
  const data = await getPartnerOperationsData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Background setup for clients and system configuration."
      />

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Clients</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Clients stay in the background. Partners are the main business records.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-teal-800"
            href="/clients"
          >
            Manage Clients
          </Link>
        </div>
        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-background">
          {data.clients.map((client) => (
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={client.id}>
              <div>
                <p className="font-semibold">{client.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.notes || "No notes"}
                </p>
              </div>
              <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold">
                {getStatusLabel(client.status)}
              </span>
            </div>
          ))}
          {!data.clients.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              RM Support will appear here after the Partner migration is run.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
