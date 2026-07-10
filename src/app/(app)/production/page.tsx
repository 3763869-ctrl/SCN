import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { updateProductionStatus } from "@/features/admin/worker-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProductionPage() {
  const supabase = await createSupabaseServerClient();
  const { data: unitEntries } = await supabase
    .from("production_units")
    .select("id, worker_id, quantity, work_date, status, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production (Units)"
        description="Review worker-submitted units and prepare future approval workflows."
      />

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Unit Review</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Worker</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Units</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(unitEntries ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {entry.worker_id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-3">{entry.work_date}</td>
                  <td className="px-5 py-3 font-medium">{entry.quantity}</td>
                  <td className="px-5 py-3 capitalize">{entry.status}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <form action={updateProductionStatus}>
                        <input name="id" type="hidden" value={entry.id} />
                        <input name="status" type="hidden" value="approved" />
                        <Button className="h-9 px-3" type="submit">
                          Approve
                        </Button>
                      </form>
                      <form action={updateProductionStatus}>
                        <input name="id" type="hidden" value={entry.id} />
                        <input name="status" type="hidden" value="rejected" />
                        <Button className="h-9 px-3" type="submit" variant="secondary">
                          Reject
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {!unitEntries?.length ? (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={5}>
                    No production units have been submitted yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
