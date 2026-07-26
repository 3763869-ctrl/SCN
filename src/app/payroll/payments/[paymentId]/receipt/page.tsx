import { notFound, redirect } from "next/navigation";

import { requireProfile } from "@/features/auth/session";
import { getBreakHours, getHoursBetween } from "@/features/worker/metrics";
import {
  addDaysToDateKey,
  EASTERN_TIME_ZONE,
  getUtcDateFromEasternDateTime,
} from "@/lib/dates/eastern-time";
import { formatHoursShort } from "@/lib/format/duration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PrintButton } from "./print-button";

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

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: EASTERN_TIME_ZONE,
});

type PayrollReceiptPageProps = {
  params: Promise<{ paymentId: string }>;
};

function getDateLabel(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : "";
}

function getTimeLabel(value: string | null | undefined) {
  return value ? timeFormatter.format(new Date(value)) : "Open";
}

function getReceiptNumber(payment: { id: string; receipt_number: string | null }) {
  return payment.receipt_number || `WPR-${payment.id.slice(0, 8).toUpperCase()}`;
}

export default async function PayrollReceiptPage({ params }: PayrollReceiptPageProps) {
  const profile = await requireProfile();
  const { paymentId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: payment } = await supabase
    .from("payroll_payments")
    .select(
      "id, payroll_id, worker_id, amount, paid_at, notes, receipt_notes, receipt_number, receipt_generated_at, created_at",
    )
    .eq("id", paymentId)
    .single();

  if (!payment) {
    notFound();
  }

  if (profile.role === "worker" && payment.worker_id !== profile.id) {
    redirect("/worker");
  }

  const [{ data: payroll }, { data: worker }] = await Promise.all([
    supabase
      .from("worker_payrolls")
      .select(
        "id, worker_id, week_start, week_end, due_date, total_hours, total_units, hourly_rate, hourly_pay, bonus_pay, total_owed, total_paid, balance_remaining, status",
      )
      .eq("id", payment.payroll_id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", payment.worker_id)
      .single(),
  ]);

  if (!payroll) {
    notFound();
  }

  const queryStart = getUtcDateFromEasternDateTime(payroll.week_start);
  const queryEnd = getUtcDateFromEasternDateTime(addDaysToDateKey(payroll.week_end, 1));
  const [{ data: timeEntries }, { data: breaks }, { data: units }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at")
      .eq("worker_id", payment.worker_id)
      .gte("clock_in_at", queryStart.toISOString())
      .lt("clock_in_at", queryEnd.toISOString())
      .order("clock_in_at", { ascending: true }),
    supabase
      .from("time_breaks")
      .select("id, time_entry_id, break_start_at, break_end_at")
      .eq("worker_id", payment.worker_id)
      .gte("break_start_at", queryStart.toISOString())
      .lt("break_start_at", queryEnd.toISOString()),
    supabase
      .from("production_units")
      .select("id, work_date, quantity, status")
      .eq("worker_id", payment.worker_id)
      .gte("work_date", payroll.week_start)
      .lte("work_date", payroll.week_end)
      .order("work_date", { ascending: true }),
  ]);

  const breaksByEntry = new Map<string, typeof breaks>();

  (breaks ?? []).forEach((breakEntry) => {
    const current = breaksByEntry.get(breakEntry.time_entry_id) ?? [];
    current.push(breakEntry);
    breaksByEntry.set(breakEntry.time_entry_id, current);
  });

  const unitsByDate = new Map<string, number>();

  (units ?? []).forEach((unit) => {
    unitsByDate.set(unit.work_date, (unitsByDate.get(unit.work_date) ?? 0) + unit.quantity);
  });

  const sessions =
    timeEntries?.map((entry) => {
      const entryBreaks = breaksByEntry.get(entry.id) ?? [];
      const grossHours = getHoursBetween(entry.clock_in_at, entry.clock_out_at);
      const netHours = Math.max(0, grossHours - getBreakHours(entryBreaks));
      const workDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: EASTERN_TIME_ZONE,
      }).format(new Date(entry.clock_in_at));

      return {
        ...entry,
        netHours,
        units: unitsByDate.get(workDate) ?? 0,
        workDate,
      };
    }) ?? [];

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950 print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <section className="bg-white p-8 print:p-0">
          <div className="flex flex-col gap-8 border-b border-slate-300 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Payroll Receipt</h1>
              <p className="mt-2 text-lg font-semibold">
                {getReceiptNumber(payment)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Work Week: {getDateLabel(payroll.week_start)} -{" "}
                {getDateLabel(payroll.week_end)}
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p>
                <span className="font-semibold">Paid:</span>{" "}
                {getDateLabel(payment.paid_at)}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {payroll.status}
              </p>
            </div>
          </div>

          <div className="grid gap-8 border-b border-slate-200 py-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Worker
              </p>
              <p className="mt-2 text-xl font-bold">
                {worker?.full_name || worker?.email || "Worker"}
              </p>
              <p className="text-sm text-slate-700">{worker?.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Paid By
              </p>
              <p className="mt-2 text-xl font-bold">RM Support</p>
            </div>
          </div>

          <table className="mt-8 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3">Start</th>
                <th className="py-3 pr-3">End</th>
                <th className="py-3 pr-3 text-right">Hours</th>
                <th className="py-3 text-right">Units</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr className="border-b border-slate-100" key={session.id}>
                  <td className="py-3 pr-3">{getDateLabel(session.workDate)}</td>
                  <td className="py-3 pr-3">{getTimeLabel(session.clock_in_at)}</td>
                  <td className="py-3 pr-3">{getTimeLabel(session.clock_out_at)}</td>
                  <td className="py-3 pr-3 text-right">
                    {formatHoursShort(session.netHours)}
                  </td>
                  <td className="py-3 text-right">{session.units}</td>
                </tr>
              ))}
              {!sessions.length ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={5}>
                    No time sessions were recorded for this pay week.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-sm space-y-3 border-t border-slate-300 pt-4 text-sm">
              <div className="flex justify-between">
                <span>Total Hours</span>
                <span className="font-semibold">
                  {formatHoursShort(Number(payroll.total_hours))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Units</span>
                <span>{payroll.total_units}</span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Rate</span>
                <span>{moneyFormatter.format(Number(payroll.hourly_rate))}</span>
              </div>
              <div className="flex justify-between">
                <span>Hourly Pay</span>
                <span>{moneyFormatter.format(Number(payroll.hourly_pay))}</span>
              </div>
              <div className="flex justify-between">
                <span>Bonus Pay</span>
                <span>{moneyFormatter.format(Number(payroll.bonus_pay))}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Owed</span>
                <span>{moneyFormatter.format(Number(payroll.total_owed))}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Payment Amount</span>
                <span>{moneyFormatter.format(Number(payment.amount))}</span>
              </div>
            </div>
          </div>

          {payment.receipt_notes ? (
            <div className="mt-8 rounded border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Note for Worker</p>
              <p className="mt-2 whitespace-pre-line text-slate-700">
                {payment.receipt_notes}
              </p>
            </div>
          ) : null}

          {payment.notes ? (
            <p className="mt-6 text-xs text-slate-500">
              Payment memo: {payment.notes}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
