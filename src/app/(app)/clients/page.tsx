import { Building2, Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient, updateClient } from "@/features/admin/client-actions";
import { getStatusLabel } from "@/features/admin/partner-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "America/New_York",
});

export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, notes, created_at, updated_at")
    .order("name", { ascending: true });

  const clientList = clients ?? [];
  const activeClients = clientList.filter((client) => client.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Background setup for companies that receive invoices. Partners stay as the main operating records."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground">Total Clients</p>
          <p className="mt-3 text-3xl font-semibold">{clientList.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground">Active</p>
          <p className="mt-3 text-3xl font-semibold">{activeClients.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground">Inactive</p>
          <p className="mt-3 text-3xl font-semibold">
            {clientList.length - activeClients.length}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <details className="app-card p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-accent">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Add Client</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open this only when adding another invoice customer.
                </p>
              </div>
            </div>
            <span className="rounded-md border border-border px-3 py-2 text-sm font-semibold">
              Add
            </span>
          </summary>
          <form action={createClient} className="mt-5 space-y-4 border-t border-border pt-5">
              <label className="block text-sm font-medium">
                Client Name
                <input
                  className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  name="name"
                  placeholder="MS Support"
                  required
                />
              </label>
              <label className="block text-sm font-medium">
                Status
                <select
                  className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  defaultValue="active"
                  name="status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Notes
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  name="notes"
                  placeholder="Billing notes, contact details, or reminders"
                />
              </label>
              <Button className="h-11 w-full" type="submit">
                Add Client
              </Button>
          </form>
        </details>

        <section className="app-card">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-accent">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Client List</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Edit client names, notes, and active status.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {clientList.map((client) => (
              <details className="group" key={client.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-muted">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{client.name}</p>
                      <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold">
                        {getStatusLabel(client.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.notes || "No notes saved"}
                    </p>
                  </div>
                  <span className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-semibold">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </span>
                </summary>

                <form
                  action={updateClient}
                  className="grid gap-4 border-t border-border bg-background px-5 py-5 lg:grid-cols-[1fr_160px] xl:grid-cols-[1fr_160px_180px]"
                >
                  <input name="client_id" type="hidden" value={client.id} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium">
                      Client Name
                      <input
                        className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        defaultValue={client.name}
                        name="name"
                        required
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Notes
                      <input
                        className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        defaultValue={client.notes ?? ""}
                        name="notes"
                        placeholder="No notes"
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-medium">
                    Status
                    <select
                      className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                      defaultValue={client.status}
                      name="status"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <div className="space-y-2">
                    <Button className="h-11 w-full" type="submit">
                      Save Changes
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Updated {dateFormatter.format(new Date(client.updated_at))}
                    </p>
                  </div>
                </form>
              </details>
            ))}

            {!clientList.length ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No clients yet. Add MS Support or another client to begin.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
