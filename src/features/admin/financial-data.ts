import { getEasternDateKey } from "@/lib/dates/eastern-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FinancialExpenseCategory } from "@/types/database";

export const expenseCategoryLabels: Record<FinancialExpenseCategory, string> = {
  banking_payment_fees: "Banking & Payment Fees",
  office_expenses: "Office Expenses",
  payroll: "Payroll",
  professional_services: "Professional Services",
  software: "Software",
  taxes_government: "Taxes & Government",
  travel: "Travel",
};

export const payrollSubcategories = [
  "Philippines Payroll",
  "Partner Compensation",
  "Bonuses",
] as const;

export const softwareExamples = [
  "ChatGPT",
  "GitHub",
  "Supabase",
  "Netlify",
  "Microsoft 365",
  "Domain",
  "Email Hosting",
  "AnyDesk",
] as const;

export const professionalServiceExamples = [
  "Accountant",
  "Bookkeeper",
  "Attorney",
  "Tax Preparation",
  "Business Consulting",
] as const;

export const taxExamples = [
  "Estimated Taxes",
  "Business Licenses",
  "Government Filing Fees",
] as const;

const todayKey = getEasternDateKey();

function getDateKeyOffset(days: number) {
  const date = new Date(`${todayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getMonthStart() {
  return `${todayKey.slice(0, 8)}01`;
}

function getYearStart() {
  return `${todayKey.slice(0, 4)}-01-01`;
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function sumBy<T>(items: T[], getValue: (item: T) => number) {
  return Math.round(items.reduce((total, item) => total + getValue(item), 0) * 100) / 100;
}

function dateInRange(value: string, start?: string, end?: string) {
  if (start && value < start) {
    return false;
  }

  if (end && value > end) {
    return false;
  }

  return true;
}

export async function getFinancialManagementData(filters?: {
  category?: string;
  clientId?: string;
  endDate?: string;
  partnerId?: string;
  startDate?: string;
  vendor?: string;
  workerId?: string;
}) {
  const supabase = await createSupabaseServerClient();

  const [
    { data: incomeRecords },
    { data: expenses },
    { data: partners },
    { data: clients },
    { data: workers },
    { data: invoices },
    { data: workerPayrolls },
    { data: partnerPayrolls },
    { data: payrollPayments },
    { data: partnerPayrollPayments },
    { data: assignments },
    { data: units },
    { data: timeEntries },
  ] = await Promise.all([
    supabase
      .from("financial_income_records")
      .select(
        "id, source, partner_id, client_id, invoice_id, invoice_payment_id, invoice_number, income_date, amount, payment_method, deposit_account, notes, created_at",
      )
      .order("income_date", { ascending: false }),
    supabase
      .from("financial_expenses")
      .select(
        "id, expense_date, vendor, category, subcategory, description, amount, payment_method, paid_from_account, partner_id, worker_id, receipt_file_name, receipt_storage_path, tax_deductible, notes, recurring, recurring_frequency, recurring_next_date, created_at",
      )
      .order("expense_date", { ascending: false }),
    supabase
      .from("partners")
      .select("id, client_id, full_name, email, phone, status"),
    supabase.from("clients").select("id, name, status"),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active")
      .in("role", ["admin", "worker"]),
    supabase
      .from("partner_invoices")
      .select("id, partner_id, client_id, invoice_number, invoice_total, total_paid, balance_remaining, status, due_date, billing_period_start, billing_period_end"),
    supabase
      .from("worker_payrolls")
      .select("id, worker_id, total_hours, total_units, hourly_pay, bonus_pay, total_owed, total_paid, balance_remaining, status, week_start, week_end"),
    supabase
      .from("partner_payrolls")
      .select("id, partner_id, invoice_id, total_owed, total_paid, balance_remaining, status, billing_period_start, billing_period_end"),
    supabase
      .from("payroll_payments")
      .select("id, payroll_id, worker_id, amount, paid_at, notes"),
    supabase
      .from("partner_payroll_payments")
      .select("id, partner_payroll_id, partner_id, amount, paid_at, notes"),
    supabase
      .from("partner_worker_assignments")
      .select("partner_id, worker_id, status, assigned_at, ended_at"),
    supabase.from("production_units").select("id, worker_id, quantity, work_date, status"),
    supabase.from("time_entries").select("id, worker_id, clock_in_at, clock_out_at"),
  ]);

  const partnerList = partners ?? [];
  const clientList = clients ?? [];
  const workerList = workers ?? [];
  const invoiceList = invoices ?? [];
  const incomeList = (incomeRecords ?? []).filter(
    (record) =>
      dateInRange(record.income_date, filters?.startDate, filters?.endDate) &&
      (!filters?.partnerId || record.partner_id === filters.partnerId) &&
      (!filters?.clientId || record.client_id === filters.clientId),
  );
  const expenseList = (expenses ?? []).filter(
    (expense) =>
      dateInRange(expense.expense_date, filters?.startDate, filters?.endDate) &&
      (!filters?.partnerId || expense.partner_id === filters.partnerId) &&
      (!filters?.workerId || expense.worker_id === filters.workerId) &&
      (!filters?.category || expense.category === filters.category) &&
      (!filters?.vendor ||
        expense.vendor.toLowerCase().includes(filters.vendor.toLowerCase())),
  );
  const workerPayrollList = workerPayrolls ?? [];
  const partnerPayrollList = partnerPayrolls ?? [];
  const payrollPaymentList = payrollPayments ?? [];
  const partnerPayrollPaymentList = partnerPayrollPayments ?? [];
  const assignmentList = assignments ?? [];
  const unitList = units ?? [];
  const timeEntryList = timeEntries ?? [];
  const partnerMap = new Map(partnerList.map((partner) => [partner.id, partner] as const));
  const clientMap = new Map(clientList.map((client) => [client.id, client] as const));
  const workerMap = new Map(workerList.map((worker) => [worker.id, worker] as const));
  const activeAssignmentMap = new Map(
    assignmentList
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => [assignment.partner_id, assignment.worker_id] as const),
  );
  const workerToActivePartnerMap = new Map(
    assignmentList
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => [assignment.worker_id, assignment.partner_id] as const),
  );

  const weekStart = getDateKeyOffset(-new Date(`${todayKey}T00:00:00Z`).getUTCDay());
  const monthStart = getMonthStart();
  const yearStart = getYearStart();
  const totalRevenue = sumBy(incomeList, (record) => numberValue(record.amount));
  const manualExpenses = sumBy(expenseList, (expense) => numberValue(expense.amount));
  const workerPayrollPaid = sumBy(
    payrollPaymentList.filter((payment) =>
      dateInRange(payment.paid_at, filters?.startDate, filters?.endDate),
    ),
    (payment) => numberValue(payment.amount),
  );
  const partnerPayrollPaid = sumBy(
    partnerPayrollPaymentList.filter((payment) =>
      dateInRange(payment.paid_at, filters?.startDate, filters?.endDate),
    ),
    (payment) => numberValue(payment.amount),
  );
  const payrollCosts = workerPayrollPaid + partnerPayrollPaid;
  const totalExpenses = manualExpenses + payrollCosts;
  const outstandingInvoices = sumBy(
    invoiceList.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)),
    (invoice) => numberValue(invoice.balance_remaining),
  );
  const payrollDue = sumBy(
    workerPayrollList.filter((payroll) => ["due", "partial"].includes(payroll.status)),
    (payroll) => numberValue(payroll.balance_remaining),
  );
  const partnerPayrollDue = sumBy(
    partnerPayrollList.filter((payroll) => ["due", "partial"].includes(payroll.status)),
    (payroll) => numberValue(payroll.balance_remaining),
  );
  const softwareCosts = sumBy(
    expenseList.filter((expense) => expense.category === "software"),
    (expense) => numberValue(expense.amount),
  );
  const taxCosts = sumBy(
    expenseList.filter((expense) => expense.category === "taxes_government"),
    (expense) => numberValue(expense.amount),
  );
  const taxesReserved = Math.round(Math.max(0, totalRevenue - totalExpenses) * 0.25 * 100) / 100;
  const unitsToday = sumBy(
    unitList.filter((unit) => unit.work_date === todayKey),
    (unit) => unit.quantity,
  );
  const unitsThisWeek = sumBy(
    unitList.filter((unit) => unit.work_date >= weekStart && unit.work_date <= todayKey),
    (unit) => unit.quantity,
  );

  const groupIncome = (key: "partner_id" | "client_id") =>
    Array.from(
      incomeList.reduce((map, record) => {
        const id = record[key] ?? "unassigned";
        map.set(id, (map.get(id) ?? 0) + numberValue(record.amount));
        return map;
      }, new Map<string, number>()),
    ).map(([id, amount]) => ({
      amount: Math.round(amount * 100) / 100,
      id,
      label:
        key === "partner_id"
          ? partnerMap.get(id)?.full_name ?? "Unassigned"
          : clientMap.get(id)?.name ?? "Unassigned",
    }));

  const incomeByMonth = Array.from(
    incomeList.reduce((map, record) => {
      const key = record.income_date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + numberValue(record.amount));
      return map;
    }, new Map<string, number>()),
  ).map(([label, amount]) => ({ amount: Math.round(amount * 100) / 100, label }));

  const expenseByCategory = Array.from(
    expenseList.reduce((map, expense) => {
      map.set(expense.category, (map.get(expense.category) ?? 0) + numberValue(expense.amount));
      return map;
    }, new Map<FinancialExpenseCategory, number>()),
  ).map(([category, amount]) => ({
    amount: Math.round(amount * 100) / 100,
    category,
    label: expenseCategoryLabels[category],
  }));

  const vendorSpending = Array.from(
    expenseList.reduce((map, expense) => {
      map.set(expense.vendor, (map.get(expense.vendor) ?? 0) + numberValue(expense.amount));
      return map;
    }, new Map<string, number>()),
  ).map(([vendor, amount]) => ({ amount: Math.round(amount * 100) / 100, vendor }));

  const partnerProfitability = partnerList.map((partner) => {
    const workerId = activeAssignmentMap.get(partner.id);
    const revenue = sumBy(
      incomeList.filter((record) => record.partner_id === partner.id),
      (record) => numberValue(record.amount),
    );
    const workerPayroll = sumBy(
      workerPayrollList.filter((payroll) => payroll.worker_id === workerId),
      (payroll) => numberValue(payroll.total_owed),
    );
    const partnerCompensation = sumBy(
      partnerPayrollList.filter((payroll) => payroll.partner_id === partner.id),
      (payroll) => numberValue(payroll.total_owed),
    );
    const assignedExpenses = sumBy(
      expenseList.filter((expense) => expense.partner_id === partner.id),
      (expense) => numberValue(expense.amount),
    );
    const productionUnits = sumBy(
      unitList.filter((unit) => unit.worker_id === workerId),
      (unit) => unit.quantity,
    );

    return {
      assignedExpenses,
      grossProfit: revenue - workerPayroll - partnerCompensation,
      netProfit: revenue - workerPayroll - partnerCompensation - assignedExpenses,
      partner,
      partnerCompensation,
      productionUnits,
      revenue,
      worker: workerId ? workerMap.get(workerId) : null,
      workerPayroll,
    };
  });

  const workerProfitability = workerList.map((worker) => {
    const partnerId = workerToActivePartnerMap.get(worker.id);
    const revenue = sumBy(
      incomeList.filter((record) => record.partner_id === partnerId),
      (record) => numberValue(record.amount),
    );
    const payroll = sumBy(
      workerPayrollList.filter((item) => item.worker_id === worker.id),
      (item) => numberValue(item.total_owed),
    );
    const units = sumBy(
      unitList.filter((unit) => unit.worker_id === worker.id),
      (unit) => unit.quantity,
    );
    const bonuses = sumBy(
      workerPayrollList.filter((item) => item.worker_id === worker.id),
      (item) => numberValue(item.bonus_pay),
    );
    const hours = sumBy(
      workerPayrollList.filter((item) => item.worker_id === worker.id),
      (item) => numberValue(item.total_hours),
    );

    return {
      bonuses,
      hours,
      payroll,
      partner: partnerId ? partnerMap.get(partnerId) : null,
      revenue,
      units,
      worker,
    };
  });

  return {
    clients: clientList,
    expenseByCategory,
    expenses: expenseList,
    income: incomeList,
    incomeByClient: groupIncome("client_id"),
    incomeByMonth,
    incomeByPartner: groupIncome("partner_id"),
    invoices: invoiceList,
    partnerPayrolls: partnerPayrollList,
    partnerProfitability,
    partners: partnerList,
    payrollPayments: payrollPaymentList,
    reports: {
      cashFlow: totalRevenue - totalExpenses,
      estimatedTaxes: taxesReserved,
      grossProfit: totalRevenue - payrollCosts,
      netProfit: totalRevenue - totalExpenses,
      payrollCosts,
      revenue: totalRevenue,
      totalExpenses,
      vendorSpending,
    },
    stats: {
      businessCash: totalRevenue - totalExpenses,
      cashAvailable: totalRevenue - totalExpenses - taxesReserved,
      grossProfit: totalRevenue - payrollCosts,
      lifetimeIncome: sumBy(incomeRecords ?? [], (record) => numberValue(record.amount)),
      monthlyIncome: sumBy(
        (incomeRecords ?? []).filter((record) => record.income_date >= monthStart),
        (record) => numberValue(record.amount),
      ),
      netProfit: totalRevenue - totalExpenses,
      outstandingInvoices,
      outstandingReceivables: outstandingInvoices,
      outstandingSettlements: partnerPayrollDue,
      partnerCompensation: partnerPayrollPaid,
      partnerPayrollDue,
      partnersActive: partnerList.filter((partner) => partner.status === "active").length,
      payrollDue,
      payrollCosts,
      softwareCosts,
      taxes: taxCosts,
      taxesReserved,
      thisWeekIncome: sumBy(
        (incomeRecords ?? []).filter((record) => record.income_date >= weekStart),
        (record) => numberValue(record.amount),
      ),
      thisYearIncome: sumBy(
        (incomeRecords ?? []).filter((record) => record.income_date >= yearStart),
        (record) => numberValue(record.amount),
      ),
      todayIncome: sumBy(
        (incomeRecords ?? []).filter((record) => record.income_date === todayKey),
        (record) => numberValue(record.amount),
      ),
      totalExpenses,
      totalRevenue,
      unitsThisWeek,
      unitsToday,
      workersOnline: timeEntryList.filter((entry) => !entry.clock_out_at).length,
    },
    workerPayrolls: workerPayrollList,
    workerProfitability,
    workers: workerList,
  };
}
