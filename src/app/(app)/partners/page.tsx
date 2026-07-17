import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import {
  assignPartnerWorker,
  createPartner,
  createPartnerInvoice,
  recordPartnerPayrollPayment,
  recordPartnerInvoicePayment,
  removePartnerWorkerAssignment,
  savePartnerBillingSettings,
  savePartnerPaySettings,
  updatePartner,
  uploadPartnerDocument,
} from "@/features/admin/partner-actions";
import {
  getPartnerLabel,
  getPartnerOperationsData,
  getStatusLabel,
} from "@/features/admin/partner-data";
import { formatHoursShort } from "@/lib/format/duration";

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

type PartnersPageProps = {
  searchParams?: Promise<{
    partner?: string;
    q?: string;
    status?: string;
    tab?: string;
  }>;
};

type PartnerTab =
  | "overview"
  | "worker"
  | "production"
  | "invoices"
  | "payments"
  | "settlements"
  | "payroll"
  | "financials"
  | "documents";

const tabs: Array<{ id: PartnerTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "worker", label: "Assigned Worker" },
  { id: "production", label: "Production" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "settlements", label: "Partner Payroll" },
  { id: "payroll", label: "Worker Payroll" },
  { id: "financials", label: "Financial Summary" },
  { id: "documents", label: "Documents" },
];

function getDateLabel(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function getTabLink(partnerId: string, tab: PartnerTab, query: string, status: string) {
  const params = new URLSearchParams({ partner: partnerId, tab });

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  return `/partners?${params.toString()}`;
}

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const params = await searchParams;
  const query = String(params?.q ?? "").trim();
  const statusFilter = String(params?.status ?? "");
  const activeTab = tabs.some((tab) => tab.id === params?.tab)
    ? (params?.tab as PartnerTab)
    : "overview";
  const data = await getPartnerOperationsData();
  const filteredSummaries = data.partnerSummaries.filter((summary) => {
    const haystack =
      `${summary.partner.full_name} ${summary.partner.email ?? ""} ${summary.partner.phone ?? ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter ? summary.partner.status === statusFilter : true;

    return matchesQuery && matchesStatus;
  });
  const selectedSummary =
    filteredSummaries.find((summary) => summary.partner.id === params?.partner) ??
    filteredSummaries[0] ??
    data.partnerSummaries[0] ??
    null;
  const selectedPartner = selectedSummary?.partner ?? null;
  const selectedInvoices = selectedPartner
    ? data.invoices.filter((invoice) => invoice.partner_id === selectedPartner.id)
    : [];
  const selectedPayments = selectedPartner
    ? data.payments.filter((payment) => payment.partner_id === selectedPartner.id)
    : [];
  const selectedPartnerPayrolls = selectedPartner
    ? data.partnerPayrolls.filter((payroll) => payroll.partner_id === selectedPartner.id)
    : [];
  const selectedDocuments = selectedPartner
    ? await Promise.all(
        data.documents
          .filter((document) => document.partner_id === selectedPartner.id)
          .map(async (document) => document),
      )
    : [];
  const defaultClientId = data.clients[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        description="Manage Partner operations, assigned workers, production, invoices, Partner payroll, and documents."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Partners", data.stats.totalPartners],
          ["Partners Working Today", data.stats.partnersWorkingToday],
          ["Outstanding Invoices", moneyFormatter.format(data.stats.outstandingInvoices)],
          [
            "Partner Payroll Due",
            moneyFormatter.format(data.stats.partnerPayrollDue),
          ],
        ].map(([label, value]) => (
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" key={label}>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <details className="mb-5 rounded-md border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Add Partner
            </summary>
            <form action={createPartner} className="mt-4 space-y-3">
              <input name="client_id" type="hidden" value={defaultClientId} />
              <input
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                name="full_name"
                placeholder="Full name"
                required
                type="text"
              />
              <input
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                name="email"
                placeholder="Email"
                type="email"
              />
              <input
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                name="phone"
                placeholder="Phone"
                type="tel"
              />
              <input
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                name="start_date"
                type="date"
              />
              <select
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                defaultValue="active"
                name="status"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                name="notes"
                placeholder="Notes"
              />
              <Button className="w-full" type="submit">
                Create Partner
              </Button>
            </form>
          </details>

          <form action="/partners" className="space-y-3">
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={query}
              name="q"
              placeholder="Search Partners"
              type="search"
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Button className="w-full" type="submit" variant="secondary">
              Filter
            </Button>
          </form>

          <div className="mt-5 space-y-2">
            {filteredSummaries.map((summary) => {
              const selected = summary.partner.id === selectedPartner?.id;

              return (
                <Link
                  className={`block rounded-md border px-3 py-3 text-sm ${
                    selected
                      ? "border-accent bg-surface-muted"
                      : "border-border bg-background"
                  }`}
                  href={getTabLink(summary.partner.id, activeTab, query, statusFilter)}
                  key={summary.partner.id}
                >
                  <span className="block font-semibold">
                    {getPartnerLabel(summary.partner)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {summary.worker
                      ? `Worker: ${summary.worker.full_name ?? summary.worker.email}`
                      : "No worker assigned"}
                  </span>
                </Link>
              );
            })}
            {!filteredSummaries.length ? (
              <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                No Partners match that search.
              </p>
            ) : null}
          </div>
        </aside>

        {selectedPartner && selectedSummary ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {getPartnerLabel(selectedPartner)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedPartner.email || "No email"} -{" "}
                    {selectedPartner.phone || "No phone"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Client: {selectedSummary.client?.name ?? "Linked Client"} - Status:{" "}
                    {getStatusLabel(selectedPartner.status)}
                  </p>
                </div>
                <details className="w-full max-w-xl rounded-md border border-border bg-background p-3 lg:ml-auto">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                    <span>Edit Partner</span>
                    <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs">
                      Open
                    </span>
                  </summary>
                  <form
                    action={updatePartner}
                    className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2"
                  >
                    <input name="id" type="hidden" value={selectedPartner.id} />
                    <input
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={selectedPartner.full_name}
                      name="full_name"
                      required
                    />
                    <select
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={selectedPartner.status}
                      name="status"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <input
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={selectedPartner.email ?? ""}
                      name="email"
                      placeholder="Email"
                    />
                    <input
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={selectedPartner.phone ?? ""}
                      name="phone"
                      placeholder="Phone"
                    />
                    <input
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      defaultValue={selectedPartner.start_date ?? ""}
                      name="start_date"
                      type="date"
                    />
                    <SaveSubmitButton className="h-10" successMessage="Partner saved.">
                      Save Partner
                    </SaveSubmitButton>
                    <textarea
                      className="min-h-16 rounded-md border border-border bg-surface px-3 py-2 text-sm sm:col-span-2"
                      defaultValue={selectedPartner.notes ?? ""}
                      name="notes"
                      placeholder="Notes"
                    />
                  </form>
                </details>
              </div>
            </section>

            <nav className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Link
                  className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                    activeTab === tab.id
                      ? "border-accent bg-surface-muted"
                      : "border-border bg-surface"
                  }`}
                  href={getTabLink(selectedPartner.id, tab.id, query, statusFilter)}
                  key={tab.id}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>

            {activeTab === "overview" ? (
              <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                <SummaryGrid summary={selectedSummary} />
                <PartnerQuickFacts summary={selectedSummary} />
              </section>
            ) : null}

            {activeTab === "worker" ? (
              <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
                <h3 className="text-base font-semibold">Assigned Worker</h3>
                <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current worker</p>
                    <p className="mt-1 font-semibold">
                      {selectedSummary.worker
                        ? selectedSummary.worker.full_name ?? selectedSummary.worker.email
                        : "None assigned"}
                    </p>
                    {selectedSummary.assignment ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned {getDateLabel(selectedSummary.assignment.assigned_at)}
                      </p>
                    ) : null}
                  </div>
                  {selectedSummary.assignment ? (
                    <form action={removePartnerWorkerAssignment}>
                      <input
                        name="assignment_id"
                        type="hidden"
                        value={selectedSummary.assignment.id}
                      />
                      <ConfirmSubmitButton
                        confirmLabel="Remove Assignment"
                        description="This will end the active worker assignment for this Partner. Past production, payroll, and history will stay saved."
                        title="Remove assigned worker?"
                        variant="secondary"
                      >
                        Remove Assignment
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
                <form action={assignPartnerWorker} className="mt-4 grid gap-3 md:grid-cols-4">
                  <input name="partner_id" type="hidden" value={selectedPartner.id} />
                  <select
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
                    name="worker_id"
                    required
                  >
                    <option value="">Select worker</option>
                    {data.workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.full_name ?? worker.email}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    name="assigned_at"
                    type="date"
                  />
                  <Button type="submit">Assign Worker</Button>
                  <textarea
                    className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-4"
                    name="notes"
                    placeholder="Assignment notes"
                  />
                </form>
              </section>
            ) : null}

            {activeTab === "production" ? <SummaryGrid summary={selectedSummary} /> : null}

            {activeTab === "invoices" ? (
              <InvoicesTab
                billingSettings={selectedSummary.billingSettings}
                client={selectedSummary.client}
                clientId={selectedPartner.client_id}
                invoices={selectedInvoices}
                partnerId={selectedPartner.id}
              />
            ) : null}

            {activeTab === "payments" ? (
              <PaymentsTab invoices={selectedInvoices} payments={selectedPayments} />
            ) : null}

            {activeTab === "settlements" ? (
              <PartnerPayrollTab
                partnerPaySettings={selectedSummary.partnerPaySettings}
                partnerId={selectedPartner.id}
                payrolls={selectedPartnerPayrolls}
              />
            ) : null}

            {activeTab === "payroll" ? (
              <PayrollTab payrolls={selectedSummary.payrolls} />
            ) : null}

            {activeTab === "financials" ? (
              <FinancialTab summary={selectedSummary} />
            ) : null}

            {activeTab === "documents" ? (
              <DocumentsTab documents={selectedDocuments} partnerId={selectedPartner.id} />
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
            Create your first Partner to begin.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryGrid({ summary }: { summary: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerSummaries"][number] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Units Today", summary.todayUnits],
        ["Units This Week", summary.weekUnits],
        ["Lifetime Units", summary.lifetimeUnits],
        [
          "Current Bonus Level",
          summary.currentBonusLevel ? `${summary.currentBonusLevel} units` : "None",
        ],
      ].map(([label, value]) => (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" key={label}>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-semibold">{value}</p>
        </div>
      ))}
    </section>
  );
}

function PartnerQuickFacts({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerSummaries"][number];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Quick Facts</h3>
      <div className="mt-4 space-y-3 text-sm">
        {[
          ["Assigned Worker", summary.worker?.full_name ?? summary.worker?.email ?? "None"],
          ["Start Date", getDateLabel(summary.partner.start_date)],
          ["Total Invoiced", moneyFormatter.format(summary.totalInvoiced)],
          ["Total Received", moneyFormatter.format(summary.totalReceived)],
          ["Gross Profit", moneyFormatter.format(summary.grossProfit)],
          ["Outstanding Balance", moneyFormatter.format(summary.outstandingInvoices)],
          ["Partner Payroll Due", moneyFormatter.format(summary.partnerPayrollDue)],
        ].map(([label, value]) => (
          <div className="flex justify-between gap-4 border-b border-border pb-2" key={label}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InvoicesTab({
  billingSettings,
  client,
  clientId,
  invoices,
  partnerId,
}: {
  billingSettings: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerSummaries"][number]["billingSettings"];
  client: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerSummaries"][number]["client"];
  clientId: string;
  invoices: Awaited<ReturnType<typeof getPartnerOperationsData>>["invoices"];
  partnerId: string;
}) {
  const clientName = client?.name ?? "Linked Client";

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold">{clientName} Billing Settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This rate is used when the invoice page generates invoices automatically.
        </p>
        <form action={savePartnerBillingSettings} className="mt-4 space-y-4">
          <input name="partner_id" type="hidden" value={partnerId} />
          <input name="client_id" type="hidden" value={clientId} />
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_220px]">
            <label className="space-y-2">
              <span className="text-sm font-semibold">{clientName} Rate Per Unit ($)</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={Number(billingSettings?.rate_per_unit ?? 0).toFixed(2)}
                min="0"
                name="rate_per_unit"
                step="0.01"
                type="number"
              />
              <span className="block text-xs text-muted-foreground">
                Amount {clientName} pays this Partner per approved unit.
              </span>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Invoice Schedule</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={billingSettings?.billing_frequency ?? "semi_monthly"}
                name="billing_frequency"
              >
                <option value="semi_monthly">Semi-monthly</option>
                <option value="manual">Manual</option>
              </select>
              <span className="block text-xs text-muted-foreground">
                Semi-monthly uses the 1st-15th and 16th-end of month.
              </span>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Payment Terms (Days)</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                defaultValue={billingSettings?.payment_terms_days ?? 15}
                min="0"
                name="payment_terms_days"
                type="number"
              />
              <span className="block text-xs text-muted-foreground">
                How many days after the invoice period ends the payment is due.
              </span>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Billing Active</span>
              <span className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
                <input
                  defaultChecked={billingSettings?.active ?? true}
                  name="active"
                  type="checkbox"
                />
                Use this Partner when generating invoices
              </span>
              <span className="block text-xs text-muted-foreground">
                Turn off if this Partner should be skipped.
              </span>
            </label>
          </div>
          <textarea
            className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            defaultValue={billingSettings?.notes ?? ""}
            name="notes"
            placeholder="Billing notes"
          />
          <div className="flex justify-end">
            <SaveSubmitButton successMessage="Billing settings saved.">
              Save Billing
            </SaveSubmitButton>
          </div>
        </form>
      </div>
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold">Invoices</h3>
        <form action={createPartnerInvoice} className="mt-4 grid gap-3 md:grid-cols-4">
          <input name="partner_id" type="hidden" value={partnerId} />
          <input name="client_id" type="hidden" value={clientId} />
          <label className="space-y-2">
            <span className="text-sm font-semibold">Invoice Number</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              name="invoice_number"
              placeholder="Invoice #"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Billing Period Start</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              name="billing_period_start"
              required
              type="date"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Billing Period End</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              name="billing_period_end"
              required
              type="date"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Invoice Status</span>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue="draft"
              name="status"
            >
              {["draft", "ready", "sent", "partial", "paid", "overdue", "cancelled"].map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Units Billed</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              min="0"
              name="units"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Rate Per Unit ($)</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              min="0"
              name="rate_per_unit"
              step="0.01"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Invoice Total ($)</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              min="0"
              name="invoice_total"
              step="0.01"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Due Date</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              name="due_date"
              type="date"
            />
          </label>
          <textarea
            className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-3"
            name="notes"
            placeholder="Notes"
          />
          <Button type="submit">Create Invoice</Button>
        </form>
        <RecordList
          empty="No invoices yet."
          items={invoices.map((invoice) => ({
            id: invoice.id,
            label: `${invoice.invoice_number} - ${moneyFormatter.format(Number(invoice.invoice_total))}`,
            meta: `${getDateLabel(invoice.billing_period_start)} - ${getDateLabel(invoice.billing_period_end)} - ${getStatusLabel(invoice.status)} - Balance ${moneyFormatter.format(Number(invoice.balance_remaining ?? invoice.invoice_total))}`,
          }))}
        />
      </div>
    </section>
  );
}

function PaymentsTab({
  invoices,
  payments,
}: {
  invoices: Awaited<ReturnType<typeof getPartnerOperationsData>>["invoices"];
  payments: Awaited<ReturnType<typeof getPartnerOperationsData>>["payments"];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Client Payments</h3>
      <form action={recordPartnerInvoicePayment} className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
          name="invoice_id"
          required
        >
          <option value="">Select invoice</option>
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoice_number} - {moneyFormatter.format(Number(invoice.invoice_total))}
            </option>
          ))}
        </select>
        <input
          name="partner_id"
          type="hidden"
          value={invoices[0]?.partner_id ?? ""}
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          min="0"
          name="amount_received"
          placeholder="Amount received"
          required
          step="0.01"
          type="number"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="date_received"
          type="date"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="payment_method"
          placeholder="Payment method"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="deposit_account"
          placeholder="Deposit account"
        />
        <textarea
          className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          name="notes"
          placeholder="Notes"
        />
        <Button type="submit">Record Payment</Button>
      </form>
      <RecordList
        empty="No payments recorded."
        items={payments.map((payment) => ({
          id: payment.id,
          label: moneyFormatter.format(Number(payment.amount_received)),
          meta: `${getDateLabel(payment.date_received)} - ${payment.payment_method || "Payment"}`,
        }))}
      />
    </section>
  );
}

function PartnerPayrollTab({
  partnerPaySettings,
  partnerId,
  payrolls,
}: {
  partnerPaySettings: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerSummaries"][number]["partnerPaySettings"];
  partnerId: string;
  payrolls: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerPayrolls"];
}) {
  const duePayrolls = payrolls.filter((payroll) => ["due", "partial"].includes(payroll.status));
  const paidPayrolls = payrolls.filter((payroll) => payroll.status === "paid");
  const savedPayType = partnerPaySettings?.pay_type ?? "none";
  const savedRuleLabel =
    savedPayType === "flat"
      ? `Flat Pay - ${moneyFormatter.format(Number(partnerPaySettings?.flat_pay_per_invoice ?? 0))} per invoice`
      : savedPayType === "percentage"
        ? `Percentage - ${Number(partnerPaySettings?.invoice_percentage ?? 0).toFixed(2)}% of invoice`
        : "No Partner Pay";

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold">Partner Pay Rule</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how this Partner gets paid when an invoice is run. Fill only
          the number that matches the selected rule.
        </p>
        <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-semibold">Currently saved: {savedRuleLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Status: {partnerPaySettings?.active ?? true ? "Active" : "Inactive"}
          </p>
          {!partnerPaySettings ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              No saved Partner pay rule found yet. Save this form once after
              running the latest Supabase migration.
            </p>
          ) : null}
        </div>
        <form action={savePartnerPaySettings} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input name="partner_id" type="hidden" value={partnerId} />
          <label className="space-y-1 text-sm font-semibold">
            <span>Pay type</span>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal"
              defaultValue={partnerPaySettings?.pay_type ?? "none"}
              name="pay_type"
            >
              <option value="none">No Partner Pay</option>
              <option value="flat">Flat Pay</option>
              <option value="percentage">Percentage</option>
            </select>
            <span className="block text-xs font-normal text-muted-foreground">
              Pick whether this Partner gets nothing, a fixed amount, or a percent.
            </span>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Flat amount per invoice</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal"
              defaultValue={Number(partnerPaySettings?.flat_pay_per_invoice ?? 0).toFixed(2)}
              min="0"
              name="flat_pay_per_invoice"
              placeholder="Example: 250.00"
              step="0.01"
              type="number"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              Use this only when pay type is Flat Pay.
            </span>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Percentage of invoice</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal"
              defaultValue={Number(partnerPaySettings?.invoice_percentage ?? 0).toFixed(2)}
              max="100"
              min="0"
              name="invoice_percentage"
              placeholder="Example: 20"
              step="0.01"
              type="number"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              Use this only when pay type is Percentage. Enter 20 for 20%.
            </span>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Status</span>
            <span className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-normal">
              <input
                defaultChecked={partnerPaySettings?.active ?? true}
                name="active"
                type="checkbox"
              />
              Active
            </span>
            <span className="block text-xs font-normal text-muted-foreground">
              Turn off to stop creating Partner Payroll for this Partner.
            </span>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Notes</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal"
              defaultValue={partnerPaySettings?.notes ?? ""}
              name="notes"
              placeholder="Optional note"
            />
          </label>
          <div className="md:col-span-2 xl:col-span-5">
            <SaveSubmitButton successMessage="Partner pay rule saved.">
              Save Partner Pay Rule
            </SaveSubmitButton>
          </div>
        </form>
      </div>
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold">Due and Partial</h3>
        <div className="mt-4 space-y-3">
          {duePayrolls.map((payroll) => (
            <PartnerPayrollCard key={payroll.id} payroll={payroll} showPaymentForm />
          ))}
          {!duePayrolls.length ? (
            <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
              No Partner payroll is due for this Partner.
            </p>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold">Paid History</h3>
        <div className="mt-4 space-y-3">
          {paidPayrolls.map((payroll) => (
            <PartnerPayrollCard key={payroll.id} payroll={payroll} />
          ))}
          {!paidPayrolls.length ? (
            <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
              No paid Partner payroll yet.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PartnerPayrollCard({
  payroll,
  showPaymentForm = false,
}: {
  payroll: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerPayrolls"][number];
  showPaymentForm?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-4 text-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <p className="font-semibold">
            {getDateLabel(payroll.billing_period_start)} -{" "}
            {getDateLabel(payroll.billing_period_end)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rule: {getStatusLabel(payroll.pay_type_snapshot)} · Flat{" "}
            {moneyFormatter.format(Number(payroll.flat_pay_snapshot))} ·{" "}
            {Number(payroll.invoice_percentage_snapshot).toFixed(2)}%
          </p>
        </div>
        <p>Owed: {moneyFormatter.format(Number(payroll.total_owed))}</p>
        <p>Balance: {moneyFormatter.format(Number(payroll.balance_remaining))}</p>
        <span className="font-semibold">{getStatusLabel(payroll.status)}</span>
      </div>
      {showPaymentForm ? (
        <form action={recordPartnerPayrollPayment} className="mt-3 grid gap-3 md:grid-cols-4">
          <input name="partner_payroll_id" type="hidden" value={payroll.id} />
          <input
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            max={Number(payroll.balance_remaining)}
            min="0"
            name="amount"
            placeholder="Amount paid"
            required
            step="0.01"
            type="number"
          />
          <input
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            name="paid_at"
            type="date"
          />
          <input
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            name="notes"
            placeholder="Notes"
          />
          <Button type="submit">Record Payment</Button>
        </form>
      ) : null}
    </div>
  );
}

function PayrollTab({
  payrolls,
}: {
  payrolls: Awaited<ReturnType<typeof getPartnerOperationsData>>["payrolls"];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Worker Payroll</h3>
      <RecordList
        empty="No completed payroll for this Partner worker yet."
        items={payrolls.slice(0, 12).map((payroll) => ({
          id: payroll.id,
          label: `${getDateLabel(payroll.week_start)} - ${getDateLabel(payroll.week_end)}`,
          meta: `${formatHoursShort(Number(payroll.total_hours))}, ${payroll.total_units} units, ${moneyFormatter.format(Number(payroll.total_owed))}`,
        }))}
      />
    </section>
  );
}

function FinancialTab({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getPartnerOperationsData>>["partnerSummaries"][number];
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total Invoiced", summary.totalInvoiced],
        ["Total Received", summary.totalReceived],
        ["Worker Payroll", summary.workerPayroll],
        ["Partner Payroll", summary.partnerPayrollOwed],
        ["Other Assigned Expenses", summary.otherAssignedExpenses],
        ["Gross Profit", summary.grossProfit],
        ["Net Profit", summary.netProfit],
        ["Outstanding Invoices", summary.outstandingInvoices],
        ["Partner Payroll Due", summary.partnerPayrollDue],
      ].map(([label, value]) => (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm" key={label}>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-semibold">
            {moneyFormatter.format(Number(value))}
          </p>
        </div>
      ))}
    </section>
  );
}

function DocumentsTab({
  documents,
  partnerId,
}: {
  documents: Awaited<ReturnType<typeof getPartnerOperationsData>>["documents"];
  partnerId: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Documents</h3>
      <form
        action={uploadPartnerDocument}
        className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
        encType="multipart/form-data"
      >
        <input name="partner_id" type="hidden" value={partnerId} />
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          name="file"
          required
          type="file"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="document_type"
          placeholder="Document type"
        />
        <Button type="submit">Upload</Button>
        <textarea
          className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-3"
          name="notes"
          placeholder="Notes"
        />
      </form>
      <RecordList
        empty="No Partner documents uploaded."
        items={documents.map((document) => ({
          id: document.id,
          label: document.file_name,
          meta: `${document.document_type || "Document"} - ${getDateLabel(document.created_at)}`,
        }))}
      />
    </section>
  );
}

function RecordList({
  empty,
  items,
}: {
  empty: string;
  items: Array<{ id: string; label: string; meta: string }>;
}) {
  return (
    <div className="mt-5 divide-y divide-border rounded-md border border-border bg-background">
      {items.map((item) => (
        <div className="px-4 py-3 text-sm" key={item.id}>
          <p className="font-semibold">{item.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
        </div>
      ))}
      {!items.length ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : null}
    </div>
  );
}
