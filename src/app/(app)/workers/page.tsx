import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  getAdminOperationsData,
  getProfileLabel,
} from "@/features/admin/data";
import { updateWorkerProfile } from "@/features/admin/worker-actions";

export default async function WorkersPage() {
  const operations = await getAdminOperationsData();
  const workers = operations.profiles;
  const activeWorkers = workers.filter((worker) => worker.active).length;
  const workerRoleCount = workers.filter((worker) => worker.role === "worker").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Admin view for worker profiles, status, and early time and production activity."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Total Profiles
          </p>
          <p className="mt-4 text-2xl font-semibold">{workers.length}</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Active Users
          </p>
          <p className="mt-4 text-2xl font-semibold">{activeWorkers}</p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Worker Role
          </p>
          <p className="mt-4 text-2xl font-semibold">{workerRoleCount}</p>
        </article>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Profiles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role and Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td className="px-5 py-3 font-medium">
                    {worker.full_name || "Unnamed"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {worker.email}
                  </td>
                  <td className="px-5 py-3">
                    <form
                      action={updateWorkerProfile}
                      className="flex items-center gap-2"
                    >
                      <input name="id" type="hidden" value={worker.id} />
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm capitalize"
                        defaultValue={worker.role}
                        name="role"
                      >
                        <option value="admin">Admin</option>
                        <option value="worker">Worker</option>
                      </select>
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                        defaultValue={String(worker.active)}
                        name="active"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                      <Button className="h-9 px-3" type="submit" variant="secondary">
                        Save
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {!workers.length ? (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={3}>
                    No profiles found. Create users in Supabase Authentication,
                    then assign a profile role.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Recent Time Entries</h2>
          <div className="mt-4 space-y-2">
            {operations.timeEntries.slice(0, 20).map((entry) => (
              <div
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                key={entry.id}
              >
                <span className="font-medium">
                  {getProfileLabel(operations.profileMap.get(entry.worker_id))}
                </span>
                <span>{entry.clock_out_at ? "Closed" : "Active"}</span>
              </div>
            ))}
            {!operations.timeEntries.length ? (
              <p className="text-sm text-muted-foreground">
                No time entries yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Recent Unit Entries</h2>
          <div className="mt-4 space-y-2">
            {operations.unitEntries.slice(0, 20).map((entry) => (
              <div
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                key={entry.id}
              >
                <span>
                  {entry.quantity} units by{" "}
                  {getProfileLabel(operations.profileMap.get(entry.worker_id))}
                </span>
                <span className="capitalize text-muted-foreground">
                  {entry.status}
                </span>
              </div>
            ))}
            {!operations.unitEntries.length ? (
              <p className="text-sm text-muted-foreground">
                No unit entries yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
