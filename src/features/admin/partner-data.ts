import { getHoursBetween } from "@/features/worker/metrics";
import {
  addDaysToDateKey,
  getEasternDateKey,
  getEasternWeekBounds,
} from "@/lib/dates/eastern-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const todayKey = getEasternDateKey();
const week = getEasternWeekBounds();
const weekEndKey = addDaysToDateKey(week.weekStartKey, 7);

export function getStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPartnerLabel(
  partner: { full_name: string; email: string | null } | undefined,
) {
  return partner?.full_name || partner?.email || "Unknown partner";
}

export async function getPartnerOperationsData() {
  const supabase = await createSupabaseServerClient();
  const [
    { data: clients },
    { data: partners },
    { data: assignments },
    { data: workers },
    { data: units },
    { data: timeEntries },
    { data: paySettings },
    { data: billingSettings },
    { data: partnerPaySettings },
    { data: bonusTiers },
    { data: payrolls },
    { data: partnerPayrolls },
    { data: partnerPayrollPayments },
    { data: invoiceRuns },
    { data: invoices },
    { data: invoiceLines },
    { data: invoicePayments },
    { data: financialExpenses },
    { data: settlements },
    { data: documents },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, status, notes"),
    supabase
      .from("partners")
      .select("id, client_id, full_name, email, phone, status, start_date, notes")
      .order("full_name", { ascending: true }),
    supabase
      .from("partner_worker_assignments")
      .select("id, partner_id, worker_id, status, assigned_at, ended_at, notes")
      .order("assigned_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active")
      .in("role", ["admin", "worker"])
      .is("deleted_at", null),
    supabase
      .from("production_units")
      .select("id, worker_id, quantity, work_date, status")
      .order("work_date", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id, worker_id, clock_in_at, clock_out_at")
      .order("clock_in_at", { ascending: false }),
    supabase
      .from("worker_pay_settings")
      .select("worker_id, hourly_rate, weekly_unit_goal"),
    supabase
      .from("partner_billing_settings")
      .select("partner_id, client_id, rate_per_unit, billing_frequency, payment_terms_days, active, notes"),
    supabase
      .from("partner_pay_settings")
      .select("partner_id, pay_type, flat_pay_per_invoice, invoice_percentage, active, notes"),
    supabase
      .from("bonus_tiers")
      .select("id, worker_id, threshold_units, bonus_amount, label, active")
      .eq("active", true)
      .order("threshold_units", { ascending: true }),
    supabase
      .from("worker_payrolls")
      .select(
        "id, worker_id, week_start, week_end, total_hours, total_units, hourly_pay, bonus_pay, total_owed, total_paid, balance_remaining, status",
      )
      .order("week_start", { ascending: false }),
    supabase
      .from("partner_payrolls")
      .select(
        "id, partner_id, invoice_id, billing_period_start, billing_period_end, pay_type_snapshot, flat_pay_snapshot, invoice_percentage_snapshot, total_owed, total_paid, balance_remaining, status",
      )
      .order("billing_period_start", { ascending: false }),
    supabase
      .from("partner_payroll_payments")
      .select("id, partner_payroll_id, partner_id, amount, paid_at, notes")
      .order("paid_at", { ascending: false }),
    supabase
      .from("invoice_runs")
      .select(
        "id, client_id, billing_period_start, billing_period_end, status, invoice_count, total_units, total_amount, generated_at, sent_at, notes",
      )
      .order("billing_period_start", { ascending: false }),
    supabase
      .from("partner_invoices")
      .select(
        "id, invoice_run_id, partner_id, client_id, invoice_number, billing_period_start, billing_period_end, units, rate_per_unit, invoice_total, created_date, sent_date, due_date, status, total_paid, balance_remaining, generated_at, voided_at, void_reason, notes",
      )
      .is("voided_at", null)
      .order("created_date", { ascending: false }),
    supabase
      .from("partner_invoice_lines")
      .select(
        "id, invoice_id, partner_id, worker_id, work_date, description, units, rate_per_unit, line_total, source",
      )
      .order("work_date", { ascending: true }),
    supabase
      .from("partner_invoice_payments")
      .select(
        "id, invoice_id, partner_id, amount_received, date_received, payment_method, deposit_account, notes, voided_at, void_reason",
      )
      .is("voided_at", null)
      .order("date_received", { ascending: false }),
    supabase
      .from("financial_expenses")
      .select("id, partner_id, amount, category, expense_date"),
    supabase
      .from("partner_settlements")
      .select(
        "id, partner_id, invoice_id, amount_received_by_partner, amount_partner_keeps, amount_transferred_to_scn, transfer_status, transfer_date, notes",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_documents")
      .select("id, partner_id, document_type, file_name, storage_path, notes, created_at"),
  ]);

  const partnerList = partners ?? [];
  const assignmentList = assignments ?? [];
  const workerList = workers ?? [];
  const unitList = units ?? [];
  const timeList = timeEntries ?? [];
  const payrollList = payrolls ?? [];
  const partnerPayrollList = partnerPayrolls ?? [];
  const partnerPayrollPaymentList = partnerPayrollPayments ?? [];
  const billingSettingList = billingSettings ?? [];
  const partnerPaySettingList = partnerPaySettings ?? [];
  const invoiceRunList = invoiceRuns ?? [];
  const invoiceList = invoices ?? [];
  const invoiceLineList = invoiceLines ?? [];
  const paymentList = invoicePayments ?? [];
  const expenseList = financialExpenses ?? [];
  const settlementList = settlements ?? [];
  const workerMap = new Map(workerList.map((worker) => [worker.id, worker] as const));
  const clientMap = new Map((clients ?? []).map((client) => [client.id, client] as const));
  const activeAssignmentMap = new Map(
    assignmentList
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => [assignment.partner_id, assignment] as const),
  );
  const paySettingsMap = new Map(
    (paySettings ?? []).map((setting) => [setting.worker_id, setting] as const),
  );
  const billingSettingsMap = new Map(
    billingSettingList.map((setting) => [setting.partner_id, setting] as const),
  );
  const partnerPaySettingsMap = new Map(
    partnerPaySettingList.map((setting) => [setting.partner_id, setting] as const),
  );

  const partnerSummaries = partnerList.map((partner) => {
    const assignment = activeAssignmentMap.get(partner.id);
    const workerId = assignment?.worker_id ?? "";
    const partnerUnits = unitList.filter((unit) => unit.worker_id === workerId);
    const todayUnits = partnerUnits
      .filter((unit) => unit.work_date === todayKey)
      .reduce((total, unit) => total + unit.quantity, 0);
    const weekUnits = partnerUnits
      .filter((unit) => unit.work_date >= week.weekStartKey && unit.work_date < weekEndKey)
      .reduce((total, unit) => total + unit.quantity, 0);
    const lifetimeUnits = partnerUnits.reduce((total, unit) => total + unit.quantity, 0);
    const partnerInvoices = invoiceList.filter((invoice) => invoice.partner_id === partner.id);
    const partnerPayments = paymentList.filter((payment) => payment.partner_id === partner.id);
    const partnerSettlements = settlementList.filter(
      (settlement) => settlement.partner_id === partner.id,
    );
    const partnerPayrollsForPartner = partnerPayrollList.filter(
      (payroll) => payroll.partner_id === partner.id,
    );
    const otherAssignedExpenses = expenseList
      .filter((expense) => expense.partner_id === partner.id)
      .reduce((total, expense) => total + Number(expense.amount), 0);
    const workerPayrolls = payrollList.filter((payroll) => payroll.worker_id === workerId);
    const totalInvoiced = partnerInvoices.reduce(
      (total, invoice) => total + Number(invoice.invoice_total),
      0,
    );
    const totalReceived = partnerPayments.reduce(
      (total, payment) => total + Number(payment.amount_received),
      0,
    );
    const workerPayroll = workerPayrolls.reduce(
      (total, payroll) => total + Number(payroll.total_owed),
      0,
    );
    const partnerCompensation = partnerSettlements.reduce(
      (total, settlement) => total + Number(settlement.amount_partner_keeps),
      0,
    );
    const partnerPayrollOwed = partnerPayrollsForPartner.reduce(
      (total, payroll) => total + Number(payroll.total_owed),
      0,
    );
    const partnerPayrollDue = partnerPayrollsForPartner
      .filter((payroll) => ["due", "partial"].includes(payroll.status))
      .reduce((total, payroll) => total + Number(payroll.balance_remaining), 0);
    const transferredToScn = partnerSettlements.reduce(
      (total, settlement) => total + Number(settlement.amount_transferred_to_scn),
      0,
    );
    const outstandingInvoices = partnerInvoices
      .filter((invoice) => !["paid", "cancelled"].includes(invoice.status))
      .reduce((total, invoice) => total + Number(invoice.invoice_total), 0);
    const outstandingSettlements = partnerSettlements
      .filter((settlement) => !["transferred", "waived", "cancelled"].includes(settlement.transfer_status))
      .reduce(
        (total, settlement) =>
          total +
          Math.max(
            0,
            Number(settlement.amount_received_by_partner) -
              Number(settlement.amount_partner_keeps) -
              Number(settlement.amount_transferred_to_scn),
          ),
        0,
      );
    const currentBonusLevel =
      (bonusTiers ?? [])
        .filter((tier) => !tier.worker_id || tier.worker_id === workerId)
        .filter((tier) => weekUnits >= tier.threshold_units)
        .at(-1)?.threshold_units ?? null;
    const isWorkingToday = Boolean(
      timeList.find(
        (entry) =>
          entry.worker_id === workerId &&
          getEasternDateKey(new Date(entry.clock_in_at)) === todayKey,
      ),
    );

    return {
      assignment,
      client: clientMap.get(partner.client_id),
      currentBonusLevel,
      grossProfit: totalReceived - workerPayroll - partnerPayrollOwed,
      isWorkingToday,
      lifetimeUnits,
      outstandingInvoices,
      outstandingSettlements,
      otherAssignedExpenses,
      partner,
      billingSettings: billingSettingsMap.get(partner.id),
      partnerPaySettings: partnerPaySettingsMap.get(partner.id),
      partnerCompensation,
      netProfit: totalReceived - workerPayroll - partnerPayrollOwed - otherAssignedExpenses,
      partnerPayrollDue,
      partnerPayrollOwed,
      partnerPayrolls: partnerPayrollsForPartner,
      payrolls: workerPayrolls,
      todayUnits,
      totalInvoiced,
      totalReceived,
      transferredToScn,
      weekUnits,
      worker: workerMap.get(workerId),
      workerPayroll,
      workerRate: Number(paySettingsMap.get(workerId)?.hourly_rate ?? 0),
    };
  });

  const workersOnline = timeList.filter((entry) => !entry.clock_out_at).length;
  const unitsToday = unitList
    .filter((unit) => unit.work_date === todayKey)
    .reduce((total, unit) => total + unit.quantity, 0);
  const unitsThisWeek = unitList
    .filter((unit) => unit.work_date >= week.weekStartKey && unit.work_date < weekEndKey)
    .reduce((total, unit) => total + unit.quantity, 0);
  const outstandingInvoices = partnerSummaries.reduce(
    (total, summary) => total + summary.outstandingInvoices,
    0,
  );
  const outstandingSettlements = partnerSummaries.reduce(
    (total, summary) => total + summary.outstandingSettlements,
    0,
  );
  const partnerPayrollDue = partnerSummaries.reduce(
    (total, summary) => total + summary.partnerPayrollDue,
    0,
  );
  const weeklyProfit = partnerSummaries.reduce(
    (total, summary) => total + summary.grossProfit,
    0,
  );
  const recentHours = timeList.reduce(
    (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
    0,
  );

  return {
    activeAssignmentMap,
    assignments: assignmentList,
    clients: clients ?? [],
    billingSettings: billingSettingList,
    documents: documents ?? [],
    invoiceLines: invoiceLineList,
    invoiceRuns: invoiceRunList,
    invoices: invoiceList,
    partners: partnerList,
    partnerSummaries,
    payments: paymentList,
    partnerPaySettings: partnerPaySettingList,
    partnerPayrollPayments: partnerPayrollPaymentList,
    partnerPayrolls: partnerPayrollList,
    payrolls: payrollList,
    recentHours,
    settlements: settlementList,
    timeEntries: timeList,
    units: unitList,
    workers: workerList,
    stats: {
      monthlyProfit: weeklyProfit,
      outstandingInvoices,
      outstandingSettlements,
      partnerPayrollDue,
      partnersWorkingToday: partnerSummaries.filter((summary) => summary.isWorkingToday)
        .length,
      totalPartners: partnerList.length,
      unitsThisWeek,
      unitsToday,
      weeklyProfit,
      workersOnline,
    },
  };
}
