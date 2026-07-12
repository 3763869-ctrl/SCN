import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { getProfileLabel } from "@/features/admin/data";
import {
  addBonusTier,
  archiveWorker,
  createWorker,
  deleteBonusTier,
  deleteWorker,
  deleteWorkerFile,
  updateBonusTier,
  updateWorkerFile,
  updateWorkerPassword,
  updateWorkerPaySettings,
  updateWorkerProfile,
  uploadWorkerFile,
} from "@/features/admin/worker-actions";
import { getHoursBetween } from "@/features/worker/metrics";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type WorkersPageProps = {
  searchParams?: Promise<{ q?: string; tab?: string; worker?: string }>;
};

type WorkerTab = "profile" | "bonuses" | "files";

function getDateLabel(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return displayDateFormatter.format(new Date(value));
}

function getTabLink(workerId: string, tab: WorkerTab, query: string) {
  const params = new URLSearchParams({ tab, worker: workerId });

  if (query) {
    params.set("q", query);
  }

  return `/workers?${params.toString()}`;
}

export default async function WorkersPage({ searchParams }: WorkersPageProps) {
  const params = await searchParams;
  const query = String(params?.q ?? "").trim();
  const activeTab = ["bonuses", "files"].includes(String(params?.tab))
    ? (params?.tab as WorkerTab)
    : "profile";
  const canCreateWorkers = hasSupabaseAdminConfig();
  const supabase = await createSupabaseServerClient();

  const [
    { data: profiles },
    { data: paySettings },
    { data: bonusTiers },
    { data: timeEntries },
    { data: unitEntries },
    { data: payrolls },
    { data: payments },
    { data: workerFiles },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active, created_at")
      .eq("role", "worker")
      .order("full_name", { ascending: true }),
    supabase
      .from("worker_pay_settings")
      .select("worker_id, hourly_rate, payroll_schedule, weekly_unit_goal, active"),
    supabase
      .from("bonus_tiers")
      .select("id, worker_id, threshold_units, bonus_amount, label, active")
      .order("threshold_units", { ascending: true }),
    supabase
      .from("time_entries")
      .select("id, worker_id, clock_in_at, clock_out_at, notes, created_at")
      .order("clock_in_at", { ascending: false })
      .limit(250),
    supabase
      .from("production_units")
      .select("id, worker_id, quantity, work_date, status, notes, created_at")
      .order("work_date", { ascending: false })
      .limit(500),
    supabase
      .from("worker_payrolls")
      .select("id, worker_id, week_start, week_end, total_owed, total_paid, status")
      .order("week_start", { ascending: false }),
    supabase
      .from("payroll_payments")
      .select("id, worker_id, amount, paid_at, notes")
      .order("paid_at", { ascending: false }),
    supabase
      .from("worker_files")
      .select(
        "id, worker_id, file_name, storage_path, document_type, signed, notes, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const workers = profiles ?? [];
  const filteredWorkers = workers.filter((worker) => {
    const haystack = `${worker.full_name ?? ""} ${worker.email}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selectedWorker =
    workers.find((worker) => worker.id === params?.worker) ??
    filteredWorkers[0] ??
    workers[0] ??
    null;
  const selectedWorkerId = selectedWorker?.id ?? "";
  const selectedPaySettings = (paySettings ?? []).find(
    (setting) => setting.worker_id === selectedWorkerId,
  );
  const selectedBonusTiers = (bonusTiers ?? []).filter(
    (tier) => !tier.worker_id || tier.worker_id === selectedWorkerId,
  );
  const selectedSpecificBonusTiers = (bonusTiers ?? []).filter(
    (tier) => tier.worker_id === selectedWorkerId,
  );
  const selectedTimeEntries = (timeEntries ?? []).filter(
    (entry) => entry.worker_id === selectedWorkerId,
  );
  const selectedUnitEntries = (unitEntries ?? []).filter(
    (entry) => entry.worker_id === selectedWorkerId,
  );
  const selectedPayrolls = (payrolls ?? []).filter(
    (payroll) => payroll.worker_id === selectedWorkerId,
  );
  const selectedPayments = (payments ?? []).filter(
    (payment) => payment.worker_id === selectedWorkerId,
  );
  const selectedFiles = (workerFiles ?? []).filter(
    (file) => file.worker_id === selectedWorkerId,
  );
  const signedFiles = await Promise.all(
    selectedFiles.map(async (file) => {
      const { data } = await supabase.storage
        .from("worker-files")
        .createSignedUrl(file.storage_path, 60 * 10);

      return {
        ...file,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
  const totalUnits = selectedUnitEntries.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  const totalHours = selectedTimeEntries.reduce(
    (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
    0,
  );
  const totalPaid = selectedPayments.reduce(
    (total, payment) => total + Number(payment.amount),
    0,
  );
  const firstClockIn = [...selectedTimeEntries]
    .filter((entry) => entry.clock_in_at)
    .sort(
      (left, right) =>
        new Date(left.clock_in_at).getTime() - new Date(right.clock_in_at).getTime(),
    )[0];
  const recentActivity = [
    ...selectedTimeEntries.slice(0, 8).map((entry) => ({
      id: `time-${entry.id}`,
      label: entry.clock_out_at ? "Clock entry closed" : "Clocked in",
      meta: timeFormatter.format(new Date(entry.clock_in_at)),
      value: `${getHoursBetween(entry.clock_in_at, entry.clock_out_at).toFixed(2)} hrs`,
    })),
    ...selectedUnitEntries.slice(0, 8).map((entry) => ({
      id: `unit-${entry.id}`,
      label: "Units entered",
      meta: getDateLabel(entry.work_date),
      value: `${entry.quantity} units`,
    })),
  ].slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Search workers, manage settings, review activity, bonuses, payments, and files."
      />

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Total Workers</p>
        <p className="mt-3 text-3xl font-semibold">{workers.length}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <details className="mb-5 rounded-md border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Add New Worker
            </summary>
            {canCreateWorkers ? (
              <form action={createWorker} className="mt-4 space-y-3">
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  name="full_name"
                  placeholder="Full name"
                  type="text"
                />
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  name="email"
                  placeholder="Email"
                  required
                  type="email"
                />
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  minLength={6}
                  name="password"
                  placeholder="Temporary password"
                  required
                  type="password"
                />
                <select
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  defaultValue="true"
                  name="active"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
                <Button className="h-10 w-full" type="submit">
                  Create Worker
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Add `SUPABASE_SERVICE_ROLE_KEY` to the server environment to create
                workers from here.
              </p>
            )}
          </details>

          <form action="/workers" className="space-y-3">
            <label className="text-sm font-semibold" htmlFor="worker-search">
              Search Workers
            </label>
            <input
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={query}
              id="worker-search"
              name="q"
              placeholder="Name or email"
              type="search"
            />
            <Button className="h-10 w-full" type="submit" variant="secondary">
              Search
            </Button>
          </form>

          <div className="mt-5 space-y-2">
            {filteredWorkers.map((worker) => {
              const selected = worker.id === selectedWorkerId;
              const href = getTabLink(worker.id, activeTab, query);

              return (
                <Link
                  className={`block rounded-md border px-3 py-3 text-sm ${
                    selected
                      ? "border-accent bg-surface-muted"
                      : "border-border bg-background"
                  }`}
                  href={href}
                  key={worker.id}
                >
                  <span className="block font-semibold">{getProfileLabel(worker)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {worker.email}
                  </span>
                </Link>
              );
            })}
            {!filteredWorkers.length ? (
              <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                No workers match that search.
              </p>
            ) : null}
          </div>
        </aside>

        {selectedWorker ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {getProfileLabel(selectedWorker)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedWorker.email}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Worker since {getDateLabel(selectedWorker.created_at)}
                    {firstClockIn
                      ? `, first clock-in ${getDateLabel(firstClockIn.clock_in_at)}`
                      : ""}
                  </p>
                </div>
                <form
                  action={updateWorkerProfile}
                  className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <input name="id" type="hidden" value={selectedWorker.id} />
                  <select
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm capitalize"
                    defaultValue={selectedWorker.role}
                    name="role"
                  >
                    <option value="admin">Admin</option>
                    <option value="worker">Worker</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={String(selectedWorker.active)}
                    name="active"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <Button className="h-10 px-4" type="submit" variant="secondary">
                    Save
                  </Button>
                </form>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Total Units
                  </p>
                  <p className="mt-2 text-xl font-semibold">{totalUnits}</p>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Total Hours
                  </p>
                  <p className="mt-2 text-xl font-semibold">{totalHours.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Payments
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {selectedPayments.length}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Total Paid
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {moneyFormatter.format(totalPaid)}
                  </p>
                </div>
              </div>
            </section>

            <nav className="flex flex-wrap gap-2">
              {(["profile", "bonuses", "files"] as WorkerTab[]).map((tab) => (
                <Link
                  className={`rounded-md border px-4 py-2 text-sm font-semibold capitalize ${
                    activeTab === tab
                      ? "border-accent bg-surface-muted"
                      : "border-border bg-surface"
                  }`}
                  href={getTabLink(selectedWorker.id, tab, query)}
                  key={tab}
                >
                  {tab === "bonuses" ? "Bonus Tiers" : tab}
                </Link>
              ))}
            </nav>

            {activeTab === "profile" ? (
              <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <h3 className="text-base font-semibold">Worker Settings</h3>
                  <form
                    action={updateWorkerPaySettings}
                    className="mt-4 grid gap-3 md:grid-cols-2"
                  >
                    <input
                      name="worker_id"
                      type="hidden"
                      value={selectedWorker.id}
                    />
                    <label className="text-sm font-medium">
                      Hourly Rate
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={Number(selectedPaySettings?.hourly_rate ?? 0)}
                        min="0"
                        name="hourly_rate"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Payroll Schedule
                      <select
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedPaySettings?.payroll_schedule ?? "weekly"}
                        name="payroll_schedule"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="semi_monthly">Semi-monthly</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Weekly Unit Goal
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedPaySettings?.weekly_unit_goal ?? 100}
                        min="1"
                        name="weekly_unit_goal"
                        step="1"
                        type="number"
                      />
                    </label>
                    <div className="flex items-end">
                      <Button className="h-10 w-full" type="submit">
                        Save Settings
                      </Button>
                    </div>
                  </form>

                  <form
                    action={updateWorkerPassword}
                    className="mt-5 rounded-md border border-border bg-background p-4"
                  >
                    <input
                      name="worker_id"
                      type="hidden"
                      value={selectedWorker.id}
                    />
                    <h4 className="text-sm font-semibold">Set Password</h4>
                    {canCreateWorkers ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                          minLength={6}
                          name="password"
                          placeholder="New temporary password"
                          required
                          type="password"
                        />
                        <Button className="h-10 px-4" type="submit" variant="secondary">
                          Update Password
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Password changes require the server-only Supabase service role
                        key.
                      </p>
                    )}
                  </form>

                  <div className="mt-5 rounded-md border border-border bg-background p-4">
                    <h4 className="text-sm font-semibold">
                      Archive or Delete Worker
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Archive keeps all history and files but deactivates the worker.
                      Delete permanently removes this worker and their history.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <form action={archiveWorker}>
                        <input name="id" type="hidden" value={selectedWorker.id} />
                        <ConfirmSubmitButton
                          confirmLabel="Archive Worker"
                          description="This will deactivate the worker login and keep their time, units, payroll, files, and history."
                          title="Archive this worker?"
                          variant="secondary"
                        >
                          Archive Worker
                        </ConfirmSubmitButton>
                      </form>
                      {canCreateWorkers ? (
                        <form action={deleteWorker}>
                          <input name="id" type="hidden" value={selectedWorker.id} />
                          <ConfirmSubmitButton
                            confirmLabel="Delete Worker"
                            description="This permanently deletes this worker, their login, time entries, units, payroll records, payments, files, and history. This cannot be undone."
                            title="Delete worker and all history?"
                            variant="secondary"
                          >
                            Delete Worker
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Deleting a worker requires the server-only Supabase service
                          role key.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-semibold">Payroll Summary</h4>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {selectedPayrolls.slice(0, 5).map((payroll) => (
                        <div
                          className="flex justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                          key={payroll.id}
                        >
                          <span>
                            {getDateLabel(payroll.week_start)} -{" "}
                            {getDateLabel(payroll.week_end)}
                          </span>
                          <span className="font-semibold text-foreground">
                            {moneyFormatter.format(Number(payroll.total_paid))} paid
                          </span>
                        </div>
                      ))}
                      {!selectedPayrolls.length ? <p>No payroll history yet.</p> : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <h3 className="text-base font-semibold">Recent Activity</h3>
                  <div className="mt-4 space-y-2">
                    {recentActivity.map((activity) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                        key={activity.id}
                      >
                        <span>
                          <span className="block font-medium">{activity.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {activity.meta}
                          </span>
                        </span>
                        <span className="font-semibold">{activity.value}</span>
                      </div>
                    ))}
                    {!recentActivity.length ? (
                      <p className="text-sm text-muted-foreground">
                        No activity recorded yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "bonuses" ? (
              <section className="grid gap-4 xl:grid-cols-[0.8fr_1fr]">
                <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <h3 className="text-base font-semibold">Add Worker Bonus Tier</h3>
                  <form action={addBonusTier} className="mt-4 space-y-3">
                    <input name="worker_id" type="hidden" value={selectedWorker.id} />
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      min="1"
                      name="threshold_units"
                      placeholder="Unit threshold"
                      required
                      step="1"
                      type="number"
                    />
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      min="0"
                      name="bonus_amount"
                      placeholder="Bonus amount"
                      required
                      step="0.01"
                      type="number"
                    />
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      name="label"
                      placeholder="Admin note shown only on popup"
                    />
                    <Button type="submit">Add Bonus</Button>
                  </form>
                </div>

                <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <h3 className="text-base font-semibold">Bonus Tiers</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Worker-specific tiers and global tiers that apply to this worker.
                  </p>
                  <div className="mt-4 space-y-3">
                    {selectedBonusTiers.map((tier) => (
                      <div
                        className="rounded-md border border-border bg-background p-3"
                        key={tier.id}
                      >
                        <form action={updateBonusTier} className="grid gap-2 text-sm">
                          <input name="id" type="hidden" value={tier.id} />
                          <input
                            name="worker_id"
                            type="hidden"
                            value={tier.worker_id ?? ""}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold">
                              {tier.worker_id ? "Worker" : "Global"}
                            </span>
                            <select
                              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                              defaultValue={String(tier.active)}
                              name="active"
                            >
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                              defaultValue={tier.threshold_units}
                              disabled={!tier.worker_id}
                              min="1"
                              name="threshold_units"
                              step="1"
                              type="number"
                            />
                            <input
                              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                              defaultValue={Number(tier.bonus_amount)}
                              disabled={!tier.worker_id}
                              min="0"
                              name="bonus_amount"
                              step="0.01"
                              type="number"
                            />
                          </div>
                          <input
                            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                            defaultValue={tier.label ?? ""}
                            disabled={!tier.worker_id}
                            name="label"
                            placeholder="Label"
                          />
                          {tier.worker_id ? (
                            <div className="flex justify-end gap-2">
                              <Button className="h-10 px-3" type="submit">
                                Save
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Global tiers are edited from the global bonus area later.
                            </p>
                          )}
                        </form>
                        {tier.worker_id ? (
                          <form action={deleteBonusTier} className="mt-2 flex justify-end">
                            <input name="id" type="hidden" value={tier.id} />
                            <Button className="h-9 px-3" type="submit" variant="secondary">
                              Delete Bonus
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {!selectedSpecificBonusTiers.length && !selectedBonusTiers.length ? (
                      <p className="text-sm text-muted-foreground">
                        No bonus tiers yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "files" ? (
              <section className="grid gap-4 xl:grid-cols-[0.8fr_1fr]">
                <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <h3 className="text-base font-semibold">Add Worker File</h3>
                  <form
                    action={uploadWorkerFile}
                    className="mt-4 space-y-3"
                    encType="multipart/form-data"
                  >
                    <input name="worker_id" type="hidden" value={selectedWorker.id} />
                    <input
                      className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      name="file"
                      required
                      type="file"
                    />
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      name="document_type"
                      placeholder="Document type, e.g. Signed agreement"
                    />
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      defaultValue="false"
                      name="signed"
                    >
                      <option value="true">Signed / Complete</option>
                      <option value="false">Not signed yet</option>
                    </select>
                    <textarea
                      className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      name="notes"
                      placeholder="Notes"
                    />
                    <Button type="submit">Upload File</Button>
                  </form>
                </div>

                <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <h3 className="text-base font-semibold">Worker Files</h3>
                  <div className="mt-4 space-y-3">
                    {signedFiles.map((file) => (
                      <div
                        className="rounded-md border border-border bg-background p-3"
                        key={file.id}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold">{file.file_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {file.document_type || "Worker document"} -{" "}
                              {file.signed ? "Signed / complete" : "Not signed yet"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Added {getDateLabel(file.created_at)}
                            </p>
                          </div>
                          {file.signedUrl ? (
                            <a
                              className="text-sm font-semibold text-accent"
                              href={file.signedUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                        <form action={updateWorkerFile} className="mt-3 grid gap-2">
                          <input name="id" type="hidden" value={file.id} />
                          <input
                            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                            defaultValue={file.document_type ?? ""}
                            name="document_type"
                            placeholder="Document type"
                          />
                          <select
                            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                            defaultValue={String(file.signed)}
                            name="signed"
                          >
                            <option value="true">Signed / Complete</option>
                            <option value="false">Not signed yet</option>
                          </select>
                          <textarea
                            className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                            defaultValue={file.notes ?? ""}
                            name="notes"
                            placeholder="Notes"
                          />
                          <div className="flex justify-end gap-2">
                            <Button className="h-10 px-3" type="submit">
                              Save File
                            </Button>
                          </div>
                        </form>
                        <form action={deleteWorkerFile} className="mt-2 flex justify-end">
                          <input name="id" type="hidden" value={file.id} />
                          <input
                            name="storage_path"
                            type="hidden"
                            value={file.storage_path}
                          />
                          <Button className="h-9 px-3" type="submit" variant="secondary">
                            Delete File
                          </Button>
                        </form>
                      </div>
                    ))}
                    {!signedFiles.length ? (
                      <p className="text-sm text-muted-foreground">
                        No files have been added for this worker yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
            No workers found.
          </div>
        )}
      </section>
    </div>
  );
}
