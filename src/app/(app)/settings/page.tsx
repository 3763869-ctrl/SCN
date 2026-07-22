import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import {
  updatePhoneSystemSettings,
  updateWorkerPhoneSettings,
} from "@/features/admin/phone-actions";
import { getPartnerOperationsData, getStatusLabel } from "@/features/admin/partner-data";
import { restoreDeletedWorker } from "@/features/admin/worker-actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { twilioConfigStatus } from "@/lib/twilio/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const businessDayOptions = [
  [0, "Sun"],
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
] as const;

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();
  const data = await getPartnerOperationsData();
  const twilioStatus = twilioConfigStatus();
  const { data: deletedWorkers } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, delete_reason, deleted_at, deletion_expires_at",
    )
    .eq("role", "worker")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  const [{ data: workers }, { data: phoneSettings }, { data: phoneSystemSettings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "worker")
      .eq("active", true)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    adminSupabase
      .from("worker_phone_settings")
      .select("worker_id, extension, phone_enabled, calling_enabled, texting_enabled, voicemail_greeting"),
    adminSupabase.from("phone_system_settings").select("*").eq("id", true).maybeSingle(),
  ]);
  const phoneSettingsMap = new Map(
    (phoneSettings ?? []).map((setting) => [setting.worker_id, setting] as const),
  );
  const phoneFlow = phoneSystemSettings ?? {
    active: true,
    after_hours_greeting:
      "Thank you for calling S C N. We are currently closed. Please leave a message and we will call you back at the first opportunity.",
    availability_mode: "business_hours",
    business_days: [0, 1, 2, 3, 4, 5],
    business_end_time: "17:00",
    business_start_time: "09:00",
    business_timezone: "America/New_York",
    ring_timeout_seconds: 60,
    voicemail_greeting: "No one is available right now. Please leave a message after the beep.",
    working_hours_greeting:
      "Thank you for calling S C N. Please enter the worker extension you are trying to reach.",
  };

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

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Phone Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Twilio secrets must be added in Vercel environment variables. SCN only
            stores worker extensions and access settings here.
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Account SID", twilioStatus.accountSid],
            ["Auth Token", twilioStatus.authToken],
            ["API Key SID", twilioStatus.apiKeySid],
            ["API Key Secret", twilioStatus.apiKeySecret],
            ["TwiML App SID", twilioStatus.twimlAppSid],
            ["Phone Number", twilioStatus.phoneNumber],
            ["Voice Ready", twilioStatus.voiceReady],
            ["Messaging Ready", twilioStatus.messagingReady],
          ].map(([label, ready]) => (
            <div className="rounded-md border border-border bg-background p-3 text-sm" key={String(label)}>
              <p className="font-semibold">{label}</p>
              <p className={`mt-1 text-xs font-semibold ${ready ? "text-accent" : "text-amber-700"}`}>
                {ready ? "Configured" : "Missing"}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-background">
          <form action={updatePhoneSystemSettings} className="space-y-4 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Main Phone Flow</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Control what callers hear, when workers ring, and when calls go straight to voicemail.
                </p>
              </div>
              <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3">
                <input defaultChecked={phoneFlow.active} name="active" type="checkbox" />
                <span className="text-sm font-semibold">Phone flow active</span>
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_160px_130px]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Availability Rule
                </span>
                <select
                  className="h-10 w-full rounded-md border border-border bg-surface px-3"
                  defaultValue={phoneFlow.availability_mode}
                  name="availability_mode"
                >
                  <option value="business_hours">Use working hours</option>
                  <option value="worker_clock">Use worker clock-in status</option>
                </select>
                <span className="block text-xs text-muted-foreground">
                  Worker clock mode rings only after the caller enters an extension for a worker who is clocked in.
                </span>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Timezone</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3"
                  defaultValue={phoneFlow.business_timezone}
                  name="business_timezone"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Open Time</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3"
                  defaultValue={String(phoneFlow.business_start_time).slice(0, 5)}
                  name="business_start_time"
                  type="time"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Close Time</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3"
                  defaultValue={String(phoneFlow.business_end_time).slice(0, 5)}
                  name="business_end_time"
                  type="time"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Ring Seconds</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3"
                  defaultValue={phoneFlow.ring_timeout_seconds}
                  max={120}
                  min={10}
                  name="ring_timeout_seconds"
                  type="number"
                />
              </label>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-muted-foreground">Working Days</legend>
              <div className="flex flex-wrap gap-2">
                {businessDayOptions.map(([value, label]) => (
                  <label
                    className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3"
                    key={value}
                  >
                    <input
                      defaultChecked={phoneFlow.business_days.includes(value)}
                      name="business_days"
                      type="checkbox"
                      value={value}
                    />
                    <span className="text-sm font-semibold">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Working-Hours Greeting
                </span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2"
                  defaultValue={phoneFlow.working_hours_greeting}
                  name="working_hours_greeting"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  After-Hours Greeting
                </span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2"
                  defaultValue={phoneFlow.after_hours_greeting}
                  name="after_hours_greeting"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Voicemail Greeting
                </span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2"
                  defaultValue={phoneFlow.voicemail_greeting}
                  name="voicemail_greeting"
                />
              </label>
            </div>
            <SaveSubmitButton successMessage="Phone flow saved.">
              Save Phone Flow
            </SaveSubmitButton>
          </form>
          {(workers ?? []).map((worker) => {
            const setting = phoneSettingsMap.get(worker.id);

            return (
              <form
                action={updateWorkerPhoneSettings}
                className="grid gap-3 px-4 py-4 text-sm xl:grid-cols-[1fr_110px_120px_120px_120px_1.5fr_auto]"
                key={worker.id}
              >
                <input name="worker_id" type="hidden" value={worker.id} />
                <div>
                  <p className="font-semibold">{worker.full_name || worker.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{worker.email}</p>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Extension</span>
                  <input
                    className="h-10 w-full rounded-md border border-border bg-surface px-3"
                    defaultValue={setting?.extension ?? ""}
                    name="extension"
                    placeholder="101"
                  />
                </label>
                {[
                  ["Phone", "phone_enabled", setting?.phone_enabled ?? false],
                  ["Calls", "calling_enabled", setting?.calling_enabled ?? false],
                  ["Texts", "texting_enabled", setting?.texting_enabled ?? false],
                ].map(([label, name, checked]) => (
                  <label
                    className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3"
                    key={String(name)}
                  >
                    <input defaultChecked={Boolean(checked)} name={String(name)} type="checkbox" />
                    <span className="text-sm font-semibold">{label}</span>
                  </label>
                ))}
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Voicemail Greeting
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-border bg-surface px-3"
                    defaultValue={setting?.voicemail_greeting ?? ""}
                    name="voicemail_greeting"
                    placeholder="Leave a message after the beep."
                  />
                </label>
                <SaveSubmitButton className="h-10" successMessage="Phone settings saved.">
                  Save
                </SaveSubmitButton>
              </form>
            );
          })}
          {!workers?.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No active workers available for phone setup.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">Deleted Workers Bin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleted workers stay here for 30 days. Restore brings back the worker
            profile with their time tracking, payroll, files, and history still attached.
          </p>
        </div>
        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-background">
          {(deletedWorkers ?? []).map((worker) => (
            <div
              className="flex flex-col gap-4 px-4 py-4 text-sm lg:flex-row lg:items-center lg:justify-between"
              key={worker.id}
            >
              <div>
                <p className="font-semibold">
                  {worker.full_name || worker.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{worker.email}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Deleted{" "}
                  {worker.deleted_at
                    ? dateFormatter.format(new Date(worker.deleted_at))
                    : "recently"}
                  {worker.deletion_expires_at
                    ? ` - Restore until ${dateFormatter.format(
                        new Date(worker.deletion_expires_at),
                      )}`
                    : ""}
                </p>
                {worker.delete_reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reason: {worker.delete_reason}
                  </p>
                ) : null}
              </div>
              <form action={restoreDeletedWorker}>
                <input name="id" type="hidden" value={worker.id} />
                <ConfirmSubmitButton
                  confirmLabel="Restore Worker"
                  description="This will reactivate the worker profile and bring the worker back to the active worker list with their saved history."
                  title="Restore this worker?"
                  variant="secondary"
                >
                  Restore
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
          {!deletedWorkers?.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No deleted workers.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
