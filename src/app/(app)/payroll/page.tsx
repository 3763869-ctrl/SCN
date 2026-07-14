import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SaveSubmitButton } from "@/components/ui/save-submit-button";
import { getProfileLabel } from "@/features/admin/data";
import {
  recordPayrollPayment,
  updatePayrollPayment,
} from "@/features/admin/payroll-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkerPayrollStatus } from "@/types/database";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-CA");

function getTodayKey() {
  return dayFormatter.format(new Date());
}

function getStatusStyles(status: WorkerPayrollStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "partial") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  if (status === "reopened") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function getDateLabel(value: string) {
  return displayDateFormatter.format(new Date(`${value}T00:00:00`));
}

function PaymentHistoryEditor({ payment }: { payment: PaymentRecord }) {
  return (
    <details className="rounded-md border border-border bg-surface">
      <summary className="grid cursor-pointer list-none gap-3 px-3 py-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <span>
          {getDateLabel(payment.paid_at)}
          {payment.notes ? ` - ${payment.notes}` : ""}
        </span>
        <span className="font-semibold text-foreground">
          {moneyFormatter.format(Number(payment.amount))}
        </span>
        <span className="text-xs font-semibold text-accent">Edit</span>
      </summary>
      <form
        action={updatePayrollPayment}
        className="grid gap-3 border-t border-border bg-background p-3 md:grid-cols-[140px_150px_1fr_auto]"
      >
        <input name="payment_id" type="hidden" value={payment.id} />
        <label className="text-sm font-medium">
          Amount
          <input
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3"
            defaultValue={Number(payment.amount)}
            min="0.01"
            name="amount"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="text-sm font-medium">
          Date
          <input
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3"
            defaultValue={payment.paid_at}
            name="paid_at"
            required
            type="date"
          />
        </label>
        <label className="text-sm font-medium">
          Note
          <input
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3"
            defaultValue={payment.notes ?? ""}
            name="notes"
            placeholder="Check, cash, memo..."
            type="text"
          />
        </label>
        <SaveSubmitButton className="mt-7 h-10" successMessage="Payroll payment saved.">
          Save
        </SaveSubmitButton>
      </form>
    </details>
  );
}

type PayrollRecord = {
  id: string;
  worker_id: string;
  week_start: string;
  week_end: string;
  due_date: string;
  total_hours: number;
  total_units: number;
  hourly_rate: number;
  hourly_pay: number;
  bonus_pay: number;
  total_owed: number;
  total_paid: number;
  balance_remaining: number;
  status: WorkerPayrollStatus;
};

type PaymentRecord = {
  id: string;
  payroll_id: string;
  amount: number;
  paid_at: string;
  notes: string | null;
};

function PayrollCard({
  payments,
  payroll,
  workerName,
}: {
  payments: PaymentRecord[];
  payroll: PayrollRecord;
  workerName: string;
}) {
  const canRecordPayment = payroll.status === "due" || payroll.status === "partial";

  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{workerName}</h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${getStatusStyles(payroll.status)}`}
            >
              {payroll.status === "due"
                ? "Due"
                : payroll.status === "partial"
                  ? "Partial"
                  : payroll.status === "paid"
                    ? "Paid"
                    : "Needs Review"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Week {getDateLabel(payroll.week_start)} - {getDateLabel(payroll.week_end)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Due Friday: {getDateLabel(payroll.due_date)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-muted-foreground">Remaining</p>
          <p className="mt-1 text-2xl font-semibold">
            {moneyFormatter.format(Number(payroll.balance_remaining))}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">Hours</p>
          <p className="mt-2 text-lg font-semibold">
            {Number(payroll.total_hours).toFixed(2)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">Units</p>
          <p className="mt-2 text-lg font-semibold">{payroll.total_units}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">Bonus</p>
          <p className="mt-2 text-lg font-semibold">
            {moneyFormatter.format(Number(payroll.bonus_pay))}
          </p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">Owed</p>
          <p className="mt-2 text-lg font-semibold">
            {moneyFormatter.format(Number(payroll.total_owed))}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">Pay Breakdown</h4>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Hourly rate</span>
              <span>{moneyFormatter.format(Number(payroll.hourly_rate))}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Hourly pay</span>
              <span>{moneyFormatter.format(Number(payroll.hourly_pay))}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Total paid</span>
              <span>{moneyFormatter.format(Number(payroll.total_paid))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">Payment History</h4>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {payments.length ? (
              payments.map((payment) => (
                <PaymentHistoryEditor key={payment.id} payment={payment} />
              ))
            ) : (
              <p>No payments recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {canRecordPayment ? (
        <form
          action={recordPayrollPayment}
          className="mt-4 grid gap-3 rounded-md border border-border bg-background p-4 md:grid-cols-[150px_150px_1fr_auto]"
        >
          <input name="payroll_id" type="hidden" value={payroll.id} />
          <input name="worker_id" type="hidden" value={payroll.worker_id} />
          <label className="text-sm font-medium">
            Amount
            <input
              className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3"
              min="0.01"
              name="amount"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="text-sm font-medium">
            Date
            <input
              className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3"
              defaultValue={getTodayKey()}
              name="paid_at"
              required
              type="date"
            />
          </label>
          <label className="text-sm font-medium">
            Note
            <input
              className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3"
              name="notes"
              placeholder="Check, cash, memo..."
              type="text"
            />
          </label>
          <Button className="mt-7 h-10" type="submit">
            Record Payment
          </Button>
        </form>
      ) : payroll.status === "reopened" ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This week was reopened in Time Tracking. Complete the week again before
          recording more payment.
        </p>
      ) : null}
    </article>
  );
}

function PaidHistoryRow({
  payments,
  payroll,
  workerName,
}: {
  payments: PaymentRecord[];
  payroll: PayrollRecord;
  workerName: string;
}) {
  return (
    <details className="group rounded-lg border border-border bg-surface p-4 shadow-sm">
      <summary className="grid cursor-pointer list-none gap-3 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center">
        <div>
          <p className="font-semibold">{workerName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Week {getDateLabel(payroll.week_start)} - {getDateLabel(payroll.week_end)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {moneyFormatter.format(Number(payroll.total_paid))}
          </p>
        </div>
        <span className="text-sm font-semibold text-accent group-open:hidden">
          View Details
        </span>
        <span className="hidden text-sm font-semibold text-muted-foreground group-open:inline">
          Hide Details
        </span>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">Week Total</h4>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Hours</span>
              <span>{Number(payroll.total_hours).toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Units</span>
              <span>{payroll.total_units}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Hourly pay</span>
              <span>{moneyFormatter.format(Number(payroll.hourly_pay))}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Bonus pay</span>
              <span>{moneyFormatter.format(Number(payroll.bonus_pay))}</span>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-foreground">
              <span>Total owed</span>
              <span>{moneyFormatter.format(Number(payroll.total_owed))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">Payments</h4>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {payments.length ? (
              payments.map((payment) => (
                <PaymentHistoryEditor key={payment.id} payment={payment} />
              ))
            ) : (
              <p>No payment details found.</p>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

export default async function PayrollPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: payrolls }, { data: profiles }, { data: payments }] =
    await Promise.all([
      supabase
        .from("worker_payrolls")
        .select(
          "id, worker_id, week_start, week_end, due_date, total_hours, total_units, hourly_rate, hourly_pay, bonus_pay, total_owed, total_paid, balance_remaining, status",
        )
        .order("due_date", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, role, active"),
      supabase
        .from("payroll_payments")
        .select("id, payroll_id, amount, paid_at, notes")
        .order("paid_at", { ascending: false }),
    ]);

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const paymentMap = new Map<string, PaymentRecord[]>();

  (payments ?? []).forEach((payment) => {
    const current = paymentMap.get(payment.payroll_id) ?? [];
    current.push(payment);
    paymentMap.set(payment.payroll_id, current);
  });

  const records = (payrolls ?? []) as PayrollRecord[];
  const dueRecords = records.filter(
    (payroll) => payroll.status === "due" || payroll.status === "reopened",
  );
  const partialRecords = records.filter((payroll) => payroll.status === "partial");
  const paidRecords = records.filter((payroll) => payroll.status === "paid");

  const renderGroup = (title: string, items: PayrollRecord[], empty: string) => (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {items.length ? (
        <div className="space-y-4">
          {items.map((payroll) => (
            <PayrollCard
              key={payroll.id}
              payments={paymentMap.get(payroll.id) ?? []}
              payroll={payroll}
              workerName={getProfileLabel(profileMap.get(payroll.worker_id))}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
          {empty}
        </div>
      )}
    </section>
  );

  const renderPaidHistory = () => (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Paid History</h2>
      {paidRecords.length ? (
        <div className="space-y-3">
          {paidRecords.map((payroll) => (
            <PaidHistoryRow
              key={payroll.id}
              payments={paymentMap.get(payroll.id) ?? []}
              payroll={payroll}
              workerName={getProfileLabel(profileMap.get(payroll.worker_id))}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
          No paid payroll history yet.
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Pay completed weekly timesheets and keep a clear payment history."
      />

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Due</p>
          <p className="mt-2 text-2xl font-semibold">{dueRecords.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Partial</p>
          <p className="mt-2 text-2xl font-semibold">{partialRecords.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Open Balance</p>
          <p className="mt-2 text-2xl font-semibold">
            {moneyFormatter.format(
              [...dueRecords, ...partialRecords].reduce(
                (total, payroll) => total + Number(payroll.balance_remaining),
                0,
              ),
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Paid History</p>
          <p className="mt-2 text-2xl font-semibold">{paidRecords.length}</p>
        </div>
      </section>

      {renderGroup("Due and Needs Review", dueRecords, "No payroll is due right now.")}
      {renderGroup("Partial Payments", partialRecords, "No partial payments right now.")}
      {renderPaidHistory()}
    </div>
  );
}
