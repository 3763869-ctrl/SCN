import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  assignPartnerWorker,
  createPartner,
  createPartnerInvoice,
  createPartnerSettlement,
  recordPartnerInvoicePayment,
  updatePartner,
  uploadPartnerDocument,
} from "@/features/admin/partner-actions";
import {
  getPartnerLabel,
  getPartnerOperationsData,
  getStatusLabel,
} from "@/features/admin/partner-data";

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
  { id: "settlements", label: "Settlements" },
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
  const selectedSettlements = selectedPartner
    ? data.settlements.filter((settlement) => settlement.partner_id === selectedPartner.id)
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
        description="Manage Partner operations, assigned workers, production, invoices, settlements, payroll, and documents."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Partners", data.stats.totalPartners],
          ["Partners Working Today", data.stats.partnersWorkingToday],
          ["Outstanding Invoices", moneyFormatter.format(data.stats.outstandingInvoices)],
          [
            "Outstanding Settlements",
            moneyFormatter.format(data.stats.outstandingSettlements),
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
                    Client: {selectedSummary.client?.name ?? "MS Support"} - Status:{" "}
                    {getStatusLabel(selectedPartner.status)}
                  </p>
                </div>
                <form action={updatePartner} className="grid gap-2 sm:grid-cols-2">
                  <input name="id" type="hidden" value={selectedPartner.id} />
                  <input
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={selectedPartner.full_name}
                    name="full_name"
                    required
                  />
                  <select
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={selectedPartner.status}
                    name="status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <input
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={selectedPartner.email ?? ""}
                    name="email"
                    placeholder="Email"
                  />
                  <input
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={selectedPartner.phone ?? ""}
                    name="phone"
                    placeholder="Phone"
                  />
                  <input
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={selectedPartner.start_date ?? ""}
                    name="start_date"
                    type="date"
                  />
                  <Button className="h-10" type="submit">
                    Save Partner
                  </Button>
                  <textarea
                    className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
                    defaultValue={selectedPartner.notes ?? ""}
                    name="notes"
                    placeholder="Notes"
                  />
                </form>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  Current worker:{" "}
                  <span className="font-semibold text-foreground">
                    {selectedSummary.worker
                      ? selectedSummary.worker.full_name ?? selectedSummary.worker.email
                      : "None assigned"}
                  </span>
                </p>
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
                clientId={selectedPartner.client_id}
                invoices={selectedInvoices}
                partnerId={selectedPartner.id}
              />
            ) : null}

            {activeTab === "payments" ? (
              <PaymentsTab invoices={selectedInvoices} payments={selectedPayments} />
            ) : null}

            {activeTab === "settlements" ? (
              <SettlementsTab
                invoices={selectedInvoices}
                partnerId={selectedPartner.id}
                settlements={selectedSettlements}
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
  clientId,
  invoices,
  partnerId,
}: {
  clientId: string;
  invoices: Awaited<ReturnType<typeof getPartnerOperationsData>>["invoices"];
  partnerId: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Invoices</h3>
      <form action={createPartnerInvoice} className="mt-4 grid gap-3 md:grid-cols-4">
        <input name="partner_id" type="hidden" value={partnerId} />
        <input name="client_id" type="hidden" value={clientId} />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="invoice_number"
          placeholder="Invoice #"
          required
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="billing_period_start"
          required
          type="date"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="billing_period_end"
          required
          type="date"
        />
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          defaultValue="draft"
          name="status"
        >
          {["draft", "ready", "sent", "paid", "overdue", "cancelled"].map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          min="0"
          name="units"
          placeholder="Units"
          type="number"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          min="0"
          name="rate_per_unit"
          placeholder="Rate per unit"
          step="0.01"
          type="number"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          min="0"
          name="invoice_total"
          placeholder="Invoice total"
          step="0.01"
          type="number"
        />
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="due_date"
          type="date"
        />
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
          meta: `${getDateLabel(invoice.billing_period_start)} - ${getDateLabel(invoice.billing_period_end)} - ${getStatusLabel(invoice.status)}`,
        }))}
      />
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
      <h3 className="text-base font-semibold">Payments from MS Support</h3>
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

function SettlementsTab({
  invoices,
  partnerId,
  settlements,
}: {
  invoices: Awaited<ReturnType<typeof getPartnerOperationsData>>["invoices"];
  partnerId: string;
  settlements: Awaited<ReturnType<typeof getPartnerOperationsData>>["settlements"];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Settlements</h3>
      <form action={createPartnerSettlement} className="mt-4 grid gap-3 md:grid-cols-3">
        <input name="partner_id" type="hidden" value={partnerId} />
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="invoice_id"
        >
          <option value="">No invoice selected</option>
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoice_number}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          defaultValue="pending"
          name="transfer_status"
        >
          {["pending", "partial", "transferred", "waived", "cancelled"].map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          name="transfer_date"
          type="date"
        />
        {[
          ["amount_received_by_partner", "Amount received by Partner"],
          ["amount_partner_keeps", "Amount Partner keeps"],
          ["amount_transferred_to_scn", "Amount transferred to SCN"],
        ].map(([name, placeholder]) => (
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            key={name}
            min="0"
            name={name}
            placeholder={placeholder}
            step="0.01"
            type="number"
          />
        ))}
        <textarea
          className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          name="notes"
          placeholder="Notes"
        />
        <Button type="submit">Save Settlement</Button>
      </form>
      <RecordList
        empty="No settlements recorded."
        items={settlements.map((settlement) => ({
          id: settlement.id,
          label: `${moneyFormatter.format(Number(settlement.amount_transferred_to_scn))} to SCN`,
          meta: `${getStatusLabel(settlement.transfer_status)} - ${getDateLabel(settlement.transfer_date)}`,
        }))}
      />
    </section>
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
          meta: `${Number(payroll.total_hours).toFixed(2)} hrs, ${payroll.total_units} units, ${moneyFormatter.format(Number(payroll.total_owed))}`,
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
        ["Partner Compensation", summary.partnerCompensation],
        ["Gross Profit", summary.grossProfit],
        ["Net Profit", summary.grossProfit],
        ["Outstanding Invoices", summary.outstandingInvoices],
        ["Outstanding Settlements", summary.outstandingSettlements],
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
