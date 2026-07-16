import Link from "next/link";
import { headers } from "next/headers";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import { getProfileLabel } from "@/features/admin/data";
import {
  addBonusTier,
  archiveWorker,
  createWorkerOnboardingLink,
  createWorker,
  deleteBonusTier,
  deleteWorker,
  deleteWorkerFile,
  updateBonusTier,
  updateWorkerFile,
  updateWorkerDetails,
  updateWorkerPassword,
  updateWorkerPaySettings,
  updateWorkerProfile,
  uploadWorkerFile,
} from "@/features/admin/worker-actions";
import { getHoursBetween } from "@/features/worker/metrics";
import { getAgeFromDateOfBirth } from "@/lib/dates/birthday";
import { EASTERN_TIME_ZONE } from "@/lib/dates/eastern-time";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: EASTERN_TIME_ZONE,
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: EASTERN_TIME_ZONE,
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
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const appOrigin = `${protocol}://${host}`;
  const query = String(params?.q ?? "").trim();
  const activeTab = ["bonuses", "files"].includes(String(params?.tab))
    ? (params?.tab as WorkerTab)
    : "profile";
  const canCreateWorkers = hasSupabaseAdminConfig();
  const supabase = await createSupabaseServerClient();

  const [
    { data: profiles },
    { data: paySettings },
    { data: workerDetails },
    { data: onboardingLinks },
    { data: bonusTiers },
    { data: timeEntries },
    { data: unitEntries },
    { data: payrolls },
    { data: payments },
    { data: workerFiles },
    { data: pushSubscriptions },
    { data: presenceChecks },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active, created_at")
      .in("role", ["admin", "worker"])
      .order("full_name", { ascending: true }),
    supabase
      .from("worker_pay_settings")
      .select("worker_id, hourly_rate, payroll_schedule, weekly_unit_goal, active"),
    supabase
      .from("worker_details")
      .select(
        "worker_id, phone_number, date_of_birth, birthday_last_shown_year, address_line1, city, state, country, zip_code, secondary_contact_name, secondary_contact_phone, start_date, hiring_source, referral_name",
      ),
    supabase
      .from("worker_onboarding_links")
      .select("id, worker_id, token, expires_at, completed_at, created_at")
      .order("created_at", { ascending: false }),
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
    supabase
      .from("worker_push_subscriptions")
      .select("id, worker_id, active, last_seen_at, created_at")
      .eq("active", true),
    supabase
      .from("worker_presence_checks")
      .select(
        "id, worker_id, status, scheduled_at, sent_at, expires_at, responded_at, auto_clock_out_at, failure_reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const workers = profiles ?? [];
  const detailsMap = new Map(
    (workerDetails ?? []).map((details) => [details.worker_id, details]),
  );
  const filteredWorkers = workers.filter((worker) => {
    const details = detailsMap.get(worker.id);
    const haystack =
      `${worker.full_name ?? ""} ${worker.email} ${details?.phone_number ?? ""} ${details?.hiring_source ?? ""} ${details?.referral_name ?? ""}`.toLowerCase();

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
  const selectedDetails = detailsMap.get(selectedWorkerId);
  const selectedOnboardingLinks = (onboardingLinks ?? []).filter(
    (link) => link.worker_id === selectedWorkerId,
  );
  const latestOnboardingLink = selectedOnboardingLinks[0] ?? null;
  const latestOnboardingUrl = latestOnboardingLink
    ? `${appOrigin}/worker-onboarding/${latestOnboardingLink.token}`
    : null;
  const selectedAge = getAgeFromDateOfBirth(selectedDetails?.date_of_birth);
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
  const selectedPushSubscriptions = (pushSubscriptions ?? []).filter(
    (subscription) => subscription.worker_id === selectedWorkerId,
  );
  const selectedPresenceChecks = (presenceChecks ?? []).filter(
    (check) => check.worker_id === selectedWorkerId,
  );
  const selectedWorkerHasPush = selectedPushSubscriptions.length > 0;
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
  const firstWorkDay =
    selectedDetails?.start_date ?? firstClockIn?.clock_in_at ?? selectedWorker?.created_at;
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
                <details className="rounded-md border border-border bg-surface-muted p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Worker Info
                  </summary>
                  <div className="mt-3 space-y-2">
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      name="phone_number"
                      placeholder="Phone number"
                      type="tel"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="date_of_birth"
                        type="date"
                      />
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="start_date"
                        type="date"
                      />
                    </div>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      name="address_line1"
                      placeholder="Address"
                      type="text"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="city"
                        placeholder="City"
                        type="text"
                      />
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="state"
                        placeholder="State"
                        type="text"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="country"
                        placeholder="Country"
                        type="text"
                      />
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="zip_code"
                        placeholder="ZIP"
                        type="text"
                      />
                    </div>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      name="secondary_contact_name"
                      placeholder="2nd contact name"
                      type="text"
                    />
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      name="secondary_contact_phone"
                      placeholder="2nd contact phone"
                      type="tel"
                    />
                    <select
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue=""
                      name="hiring_source"
                    >
                      <option value="">Hiring source</option>
                      <option value="Referral">Referral</option>
                      <option value="Indeed">Indeed</option>
                      <option value="Walk-in">Walk-in</option>
                      <option value="Agency">Agency</option>
                      <option value="Friend / Family">Friend / Family</option>
                      <option value="Returning worker">Returning worker</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      name="referral_name"
                      placeholder="Referral name"
                      type="text"
                    />
                  </div>
                </details>
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
                    First work day {getDateLabel(firstWorkDay)}
                    {firstClockIn
                      ? `, first clock-in ${getDateLabel(firstClockIn.clock_in_at)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Account created {getDateLabel(selectedWorker.created_at)}
                  </p>
                  {selectedDetails?.phone_number || selectedDetails?.start_date ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedDetails.phone_number ?? ""}
                      {selectedDetails.phone_number && selectedDetails.start_date
                        ? " - "
                        : ""}
                      {selectedDetails.start_date
                        ? `Start date ${getDateLabel(selectedDetails.start_date)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <details className="w-full rounded-md border border-border bg-background p-3 lg:max-w-md">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                    <span>Edit Worker Access</span>
                    <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs">
                      Open
                    </span>
                  </summary>
                  <form
                    action={updateWorkerProfile}
                    className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2"
                  >
                    <input name="id" type="hidden" value={selectedWorker.id} />
                    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                      Full Name
                      <input
                        className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal text-foreground"
                        defaultValue={selectedWorker.full_name ?? ""}
                        name="full_name"
                        placeholder="Worker full name"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                      Email
                      <input
                        className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal text-foreground"
                        defaultValue={selectedWorker.email}
                        name="email"
                        placeholder="Worker email"
                        required
                        type="email"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                      Role
                      <select
                        className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal text-foreground capitalize"
                        defaultValue={selectedWorker.role}
                        name="role"
                      >
                        <option value="admin">Admin</option>
                        <option value="worker">Worker</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                      Status
                      <select
                        className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal text-foreground"
                        defaultValue={String(selectedWorker.active)}
                        name="active"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">
                      First Day of Work
                      <input
                        className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-normal text-foreground"
                        defaultValue={selectedDetails?.start_date ?? ""}
                        name="start_date"
                        type="date"
                      />
                    </label>
                    <SaveSubmitButton
                      className="h-10 px-4 sm:col-span-2"
                      successMessage="Worker profile saved."
                      variant="secondary"
                    >
                      Save
                    </SaveSubmitButton>
                  </form>
                </details>
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
                <div className="rounded-md border border-border bg-background p-3 sm:col-span-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Check-In Notifications
                  </p>
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      selectedWorkerHasPush ? "text-accent" : "text-amber-700"
                    }`}
                  >
                    {selectedWorkerHasPush
                      ? `Enabled on ${selectedPushSubscriptions.length} browser${
                          selectedPushSubscriptions.length === 1 ? "" : "s"
                        }`
                      : "Not enabled"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedWorkerHasPush
                      ? `Last seen ${getDateLabel(selectedPushSubscriptions[0].last_seen_at)}`
                      : "Worker must enable Chrome notifications before clocking in."}
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Worker Details</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Profile information is shown first. Open edit only when changing it.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ["Phone", selectedDetails?.phone_number || "Not recorded"],
                      [
                        "Date of Birth",
                        selectedDetails?.date_of_birth
                          ? `${getDateLabel(selectedDetails.date_of_birth)}${
                              selectedAge !== null ? `, age ${selectedAge}` : ""
                            }`
                          : "Not recorded",
                      ],
                      [
                        "Address",
                        [
                          selectedDetails?.address_line1,
                          selectedDetails?.city,
                          selectedDetails?.state,
                          selectedDetails?.zip_code,
                          selectedDetails?.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Not recorded",
                      ],
                      [
                        "Emergency Contact",
                        [
                          selectedDetails?.secondary_contact_name,
                          selectedDetails?.secondary_contact_phone,
                        ]
                          .filter(Boolean)
                          .join(" - ") || "Not recorded",
                      ],
                      [
                        "Start Date",
                        selectedDetails?.start_date
                          ? getDateLabel(selectedDetails.start_date)
                          : "Not recorded",
                      ],
                      ["Hiring Source", selectedDetails?.hiring_source || "Not recorded"],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-md border border-border bg-background p-3"
                        key={label}
                      >
                        <p className="text-xs font-semibold text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>

                  <details className="mt-5 rounded-md border border-border bg-background p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                      <span>Edit Worker Details</span>
                      <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs">
                        Open
                      </span>
                    </summary>
                    <form
                    action={updateWorkerDetails}
                    className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2"
                  >
                    <input
                      name="worker_id"
                      type="hidden"
                      value={selectedWorker.id}
                    />
                    <label className="text-sm font-medium">
                      Phone Number
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.phone_number ?? ""}
                        name="phone_number"
                        type="tel"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Date of Birth
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.date_of_birth ?? ""}
                        name="date_of_birth"
                        type="date"
                      />
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Age: {selectedAge ?? "Not recorded"}
                      </span>
                    </label>
                    <label className="text-sm font-medium md:col-span-2">
                      Address
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.address_line1 ?? ""}
                        name="address_line1"
                        type="text"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      City
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.city ?? ""}
                        name="city"
                        type="text"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      State
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.state ?? ""}
                        name="state"
                        type="text"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Country
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.country ?? ""}
                        name="country"
                        type="text"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      ZIP
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.zip_code ?? ""}
                        name="zip_code"
                        type="text"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Emergency Contact Name
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.secondary_contact_name ?? ""}
                        name="secondary_contact_name"
                        type="text"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Emergency Contact Phone
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.secondary_contact_phone ?? ""}
                        name="secondary_contact_phone"
                        type="tel"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Start Date
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.start_date ?? ""}
                        name="start_date"
                        type="date"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Hiring Source
                      <select
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.hiring_source ?? ""}
                        name="hiring_source"
                      >
                        <option value="">Not recorded</option>
                        <option value="Referral">Referral</option>
                        <option value="Indeed">Indeed</option>
                        <option value="Walk-in">Walk-in</option>
                        <option value="Agency">Agency</option>
                        <option value="Friend / Family">Friend / Family</option>
                        <option value="Returning worker">Returning worker</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium md:col-span-2">
                      Referral Name
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        defaultValue={selectedDetails?.referral_name ?? ""}
                        name="referral_name"
                        type="text"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <SaveSubmitButton className="h-10" successMessage="Worker details saved.">
                        Save Worker Details
                      </SaveSubmitButton>
                    </div>
                    </form>
                  </details>

                  <div className="mt-6">
                    <h3 className="text-base font-semibold">Check-In History</h3>
                    <div className="mt-4 space-y-2">
                      {selectedPresenceChecks.slice(0, 5).map((check) => (
                        <div
                          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          key={check.id}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold capitalize">
                              {check.status.replaceAll("_", " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getDateLabel(check.sent_at ?? check.scheduled_at)}
                            </span>
                          </div>
                          {check.auto_clock_out_at ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Auto clocked out at{" "}
                              {timeFormatter.format(new Date(check.auto_clock_out_at))}
                            </p>
                          ) : null}
                          {check.failure_reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {check.failure_reason}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {!selectedPresenceChecks.length ? (
                        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                          No check-ins recorded yet.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-base font-semibold">Pay Settings</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Hourly Rate
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {moneyFormatter.format(
                            Number(selectedPaySettings?.hourly_rate ?? 0),
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Payroll Schedule
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {selectedPaySettings?.payroll_schedule === "semi_monthly"
                            ? "Semi-monthly"
                            : "Weekly"}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Weekly Unit Goal
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {selectedPaySettings?.weekly_unit_goal ?? 100}
                        </p>
                      </div>
                    </div>
                  </div>

                  <details className="mt-5 rounded-md border border-border bg-background p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                      <span>Edit Pay Settings</span>
                      <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs">
                        Open
                      </span>
                    </summary>
                    <form
                      action={updateWorkerPaySettings}
                      className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2"
                    >
                      <input
                        name="worker_id"
                        type="hidden"
                        value={selectedWorker.id}
                      />
                      <label className="text-sm font-medium">
                        Hourly Rate
                        <input
                          className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
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
                          className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                          defaultValue={
                            selectedPaySettings?.payroll_schedule ?? "weekly"
                          }
                          name="payroll_schedule"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="semi_monthly">Semi-monthly</option>
                        </select>
                      </label>
                      <label className="text-sm font-medium">
                        Weekly Unit Goal
                        <input
                          className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                          defaultValue={selectedPaySettings?.weekly_unit_goal ?? 100}
                          min="1"
                          name="weekly_unit_goal"
                          step="1"
                          type="number"
                        />
                      </label>
                      <div className="flex items-end">
                        <SaveSubmitButton
                          className="h-10 w-full"
                          successMessage="Worker pay settings saved."
                        >
                          Save Settings
                        </SaveSubmitButton>
                      </div>
                    </form>
                  </details>

                  <details className="mt-5 rounded-md border border-border bg-background p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                      <span>Set Password</span>
                      <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs">
                        Open
                      </span>
                    </summary>
                    <form action={updateWorkerPassword} className="mt-4 border-t border-border pt-4">
                      <input
                        name="worker_id"
                        type="hidden"
                        value={selectedWorker.id}
                      />
                      {canCreateWorkers ? (
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
                        <p className="text-sm leading-6 text-muted-foreground">
                          Password changes require the server-only Supabase service role
                          key.
                        </p>
                      )}
                    </form>
                  </details>

                  <div className="mt-5 rounded-md border border-border bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">
                          Worker Info Link
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Share a private link so the worker can fill in contact,
                          address, date of birth, and emergency contact info.
                          Start date and hiring source stay admin-only.
                        </p>
                      </div>
                      <form action={createWorkerOnboardingLink}>
                        <input
                          name="worker_id"
                          type="hidden"
                          value={selectedWorker.id}
                        />
                        <Button className="h-10" type="submit" variant="secondary">
                          Create Link
                        </Button>
                      </form>
                    </div>
                    {latestOnboardingUrl ? (
                      <div className="mt-4 rounded-md border border-border bg-surface-muted p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Latest Link
                        </p>
                        <p className="mt-2 break-all font-mono text-xs">
                          {latestOnboardingUrl}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {latestOnboardingLink.completed_at
                              ? `Completed ${getDateLabel(latestOnboardingLink.completed_at)}`
                              : "Not completed yet"}
                          </span>
                          {latestOnboardingLink.expires_at ? (
                            <span>
                              Expires {getDateLabel(latestOnboardingLink.expires_at)}
                            </span>
                          ) : null}
                          <Link
                            className="font-semibold text-accent"
                            href={latestOnboardingUrl}
                            target="_blank"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No private link has been created yet.
                      </p>
                    )}
                  </div>

                  {selectedWorker.role === "worker" ? (
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
                  ) : null}

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
                              <SaveSubmitButton
                                className="h-10 px-3"
                                successMessage="Bonus tier saved."
                              >
                                Save
                              </SaveSubmitButton>
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
              <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Worker Files</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {signedFiles.length} file{signedFiles.length === 1 ? "" : "s"} on
                      record.
                    </p>
                  </div>
                  <details className="rounded-md border border-border bg-background p-3 sm:min-w-72">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Upload File
                    </summary>
                    <form
                      action={uploadWorkerFile}
                      className="mt-4 space-y-3"
                      encType="multipart/form-data"
                    >
                      <input name="worker_id" type="hidden" value={selectedWorker.id} />
                      <input
                        className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                        name="file"
                        required
                        type="file"
                      />
                      <input
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        name="document_type"
                        placeholder="Document type"
                      />
                      <select
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        defaultValue="false"
                        name="signed"
                      >
                        <option value="true">Signed / Complete</option>
                        <option value="false">Not signed yet</option>
                      </select>
                      <textarea
                        className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                        name="notes"
                        placeholder="Notes"
                      />
                      <Button className="h-10 w-full" type="submit">
                        Upload
                      </Button>
                    </form>
                  </details>
                </div>

                <div className="mt-5 divide-y divide-border rounded-md border border-border bg-background">
                  {signedFiles.map((file) => (
                    <details className="group p-3" key={file.id}>
                      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="block font-semibold">{file.file_name}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {file.document_type || "Worker document"} -{" "}
                            {file.signed ? "Signed / complete" : "Not signed yet"} -
                            Added {getDateLabel(file.created_at)}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 text-sm font-semibold">
                          {file.signedUrl ? (
                            <a
                              className="text-accent"
                              href={file.signedUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open
                            </a>
                          ) : null}
                          <span className="text-muted-foreground group-open:hidden">
                            Edit
                          </span>
                          <span className="hidden text-muted-foreground group-open:inline">
                            Close
                          </span>
                        </span>
                      </summary>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <form
                          action={updateWorkerFile}
                          className="grid gap-2 md:grid-cols-[1fr_180px_auto]"
                        >
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
                          <SaveSubmitButton
                            className="h-10 px-3"
                            successMessage="Worker file saved."
                          >
                            Save
                          </SaveSubmitButton>
                          <textarea
                            className="min-h-16 rounded-md border border-border bg-surface px-3 py-2 text-sm md:col-span-3"
                            defaultValue={file.notes ?? ""}
                            name="notes"
                            placeholder="Notes"
                          />
                        </form>
                        <form action={deleteWorkerFile}>
                          <input name="id" type="hidden" value={file.id} />
                          <input
                            name="storage_path"
                            type="hidden"
                            value={file.storage_path}
                          />
                          <Button className="h-10 px-3" type="submit" variant="secondary">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </details>
                  ))}
                  {!signedFiles.length ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No files have been added for this worker yet.
                    </p>
                  ) : null}
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
