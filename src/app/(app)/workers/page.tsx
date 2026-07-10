import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  getAdminOperationsData,
  getProfileLabel,
} from "@/features/admin/data";
import {
  addBonusTier,
  updateBonusTier,
  updateWorkerPaySettings,
  updateWorkerProfile,
} from "@/features/admin/worker-actions";

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

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Worker Pay Settings</h2>
          <div className="mt-4 space-y-3">
            {workers
              .filter((worker) => worker.role === "worker")
              .map((worker) => {
                const setting = operations.paySettingsMap.get(worker.id);

                return (
                  <form
                    action={updateWorkerPaySettings}
                    className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_auto]"
                    key={worker.id}
                  >
                    <input name="worker_id" type="hidden" value={worker.id} />
                    <div>
                      <p className="text-sm font-semibold">
                        {getProfileLabel(worker)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {worker.email}
                      </p>
                    </div>
                    <input
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={Number(setting?.hourly_rate ?? 0)}
                      min="0"
                      name="hourly_rate"
                      placeholder="Hourly rate"
                      step="0.01"
                      type="number"
                    />
                    <select
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={setting?.payroll_schedule ?? "weekly"}
                      name="payroll_schedule"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="semi_monthly">Semi-monthly</option>
                    </select>
                    <input
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={setting?.weekly_unit_goal ?? 100}
                      min="1"
                      name="weekly_unit_goal"
                      placeholder="Weekly goal"
                      step="1"
                      type="number"
                    />
                    <Button className="h-10 px-3" type="submit">
                      Save
                    </Button>
                  </form>
                );
              })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold">Bonus Tiers</h2>
          <form action={addBonusTier} className="mt-4 space-y-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              name="worker_id"
            >
              <option value="">All workers</option>
              {workers
                .filter((worker) => worker.role === "worker")
                .map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {getProfileLabel(worker)}
                  </option>
                ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                min="1"
                name="threshold_units"
                placeholder="Unit threshold"
                required
                step="1"
                type="number"
              />
              <input
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                min="0"
                name="bonus_amount"
                placeholder="Bonus amount"
                required
                step="0.01"
                type="number"
              />
            </div>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              name="label"
              placeholder="Label"
            />
            <Button type="submit">Add Bonus</Button>
          </form>
          <div className="mt-5 space-y-2">
            {operations.bonusTiers.map((tier) => (
              <form
                action={updateBonusTier}
                className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm"
                key={tier.id}
              >
                <input name="id" type="hidden" value={tier.id} />
                <select
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                  defaultValue={tier.worker_id ?? ""}
                  name="worker_id"
                >
                  <option value="">All workers</option>
                  {workers
                    .filter((worker) => worker.role === "worker")
                    .map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {getProfileLabel(worker)}
                      </option>
                    ))}
                </select>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                    defaultValue={tier.threshold_units}
                    min="1"
                    name="threshold_units"
                    step="1"
                    type="number"
                  />
                  <input
                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                    defaultValue={Number(tier.bonus_amount)}
                    min="0"
                    name="bonus_amount"
                    step="0.01"
                    type="number"
                  />
                </div>
                <input
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                  defaultValue={tier.label ?? ""}
                  name="label"
                  placeholder="Label"
                />
                <div className="flex items-center gap-2">
                  <select
                    className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm"
                    defaultValue={String(tier.active)}
                    name="active"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <Button className="h-10 px-3" type="submit" variant="secondary">
                    Save
                  </Button>
                </div>
              </form>
            ))}
          </div>
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
