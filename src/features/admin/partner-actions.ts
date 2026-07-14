"use server";

import { revalidatePath } from "next/cache";

import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PartnerInvoiceStatus,
  PartnerPayrollStatus,
  PartnerPayType,
  PartnerSettlementStatus,
  PartnerStatus,
} from "@/types/database";

const DEFAULT_CLIENT_NAME = "RM Support";

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value || null;
}

function optionalDate(formData: FormData, name: string) {
  return optionalText(formData, name);
}

function moneyValue(formData: FormData, name: string) {
  const value = Number(formData.get(name) ?? 0);

  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function integerValue(formData: FormData, name: string) {
  return Math.floor(moneyValue(formData, name));
}

function addDaysToDateKey(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getInvoicePrefix(clientName: string | null | undefined) {
  const firstWord = (clientName ?? "")
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^a-z0-9]/gi, "");

  if (firstWord && firstWord.length <= 4) {
    return firstWord.toUpperCase();
  }

  const initials = (clientName ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase();

  return initials || "INV";
}

function getInvoiceStatus(totalOwed: number, totalPaid: number): PartnerInvoiceStatus {
  if (totalPaid >= totalOwed && totalOwed > 0) {
    return "paid";
  }

  if (totalPaid > 0) {
    return "partial";
  }

  return "sent";
}

function getPartnerPayrollStatus(totalOwed: number, totalPaid: number): PartnerPayrollStatus {
  if (totalPaid >= totalOwed && totalOwed > 0) {
    return "paid";
  }

  if (totalPaid > 0) {
    return "partial";
  }

  return "due";
}

async function updateInvoiceRunTotals(invoiceRunId: string | null) {
  if (!invoiceRunId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: runInvoices } = await supabase
    .from("partner_invoices")
    .select("units, invoice_total")
    .eq("invoice_run_id", invoiceRunId)
    .is("voided_at", null)
    .neq("status", "cancelled");
  const runUnits = (runInvoices ?? []).reduce(
    (total, item) => total + Number(item.units),
    0,
  );
  const runTotal = (runInvoices ?? []).reduce(
    (total, item) => total + Number(item.invoice_total),
    0,
  );

  await supabase
    .from("invoice_runs")
    .update({
      invoice_count: runInvoices?.length ?? 0,
      total_amount: Math.round(runTotal * 100) / 100,
      total_units: runUnits,
    })
    .eq("id", invoiceRunId);
}

async function getActiveInvoicePaymentsTotal(invoiceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: payments } = await supabase
    .from("partner_invoice_payments")
    .select("amount_received")
    .eq("invoice_id", invoiceId)
    .is("voided_at", null);

  return (payments ?? []).reduce(
    (total, payment) => total + Number(payment.amount_received),
    0,
  );
}

async function createFlatPartnerPayrollFromInvoice(invoiceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("id, partner_id, billing_period_start, billing_period_end, invoice_total")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    return;
  }

  const { data: setting } = await supabase
    .from("partner_pay_settings")
    .select("pay_type, flat_pay_per_invoice, invoice_percentage, active")
    .eq("partner_id", invoice.partner_id)
    .maybeSingle();

  if (setting && !setting.active) {
    return;
  }

  const payType = (setting?.pay_type ?? "none") as PartnerPayType;

  if (payType === "none") {
    return;
  }

  const flatPay = Number(setting?.flat_pay_per_invoice ?? 0);
  const percentage = Number(setting?.invoice_percentage ?? 0);
  const invoiceTotal = Number(invoice.invoice_total ?? 0);
  const totalOwed =
    payType === "percentage"
      ? Math.round(invoiceTotal * (percentage / 100) * 100) / 100
      : flatPay;

  await supabase.from("partner_payrolls").upsert(
    {
      balance_remaining: totalOwed,
      billing_period_end: invoice.billing_period_end,
      billing_period_start: invoice.billing_period_start,
      flat_pay_snapshot: flatPay,
      invoice_percentage_snapshot: percentage,
      invoice_id: invoice.id,
      partner_id: invoice.partner_id,
      pay_type_snapshot: payType,
      status: totalOwed > 0 ? "due" : "paid",
      total_owed: totalOwed,
      total_paid: 0,
    },
    { onConflict: "invoice_id" },
  );
}

async function getDefaultClientId() {
  const supabase = await createSupabaseServerClient();
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("name", DEFAULT_CLIENT_NAME)
    .maybeSingle();

  if (existingClient?.id) {
    return existingClient.id;
  }

  const { data: oldClient } = await supabase
    .from("clients")
    .select("id")
    .eq("name", "MS Support")
    .maybeSingle();

  if (oldClient?.id) {
    await supabase
      .from("clients")
      .update({ name: DEFAULT_CLIENT_NAME })
      .eq("id", oldClient.id);

    return oldClient.id;
  }

  const { data: createdClient } = await supabase
    .from("clients")
    .insert({
      name: DEFAULT_CLIENT_NAME,
      notes: "Initial client for partner production work.",
      status: "active",
    })
    .select("id")
    .single();

  return createdClient?.id ?? "";
}

export async function savePartnerBillingSettings(formData: FormData) {
  const admin = await requireAdminProfile();

  const partnerId = String(formData.get("partner_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");

  if (!partnerId || !clientId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("partner_billing_settings").upsert(
    {
      active: formData.get("active") === "on",
      billing_frequency: String(
        formData.get("billing_frequency") ?? "semi_monthly",
      ) as "semi_monthly" | "manual",
      client_id: clientId,
      notes: optionalText(formData, "notes"),
      partner_id: partnerId,
      payment_terms_days: integerValue(formData, "payment_terms_days"),
      rate_per_unit: moneyValue(formData, "rate_per_unit"),
    },
    { onConflict: "partner_id" },
  );
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: partnerId,
    entityType: "partner",
    eventType: "partner.billing_settings.update",
    metadata: {
      active: formData.get("active") === "on",
      clientId,
      paymentTermsDays: integerValue(formData, "payment_terms_days"),
      ratePerUnit: moneyValue(formData, "rate_per_unit"),
    },
    summary: "Updated partner billing settings",
  });

  revalidatePath("/partners");
  revalidatePath("/invoices");
}

export async function savePartnerPaySettings(formData: FormData) {
  const admin = await requireAdminProfile();

  const partnerId = String(formData.get("partner_id") ?? "");

  if (!partnerId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("partner_pay_settings").upsert(
    {
      active: formData.get("active") === "on",
      invoice_percentage: moneyValue(formData, "invoice_percentage"),
      flat_pay_per_invoice: moneyValue(formData, "flat_pay_per_invoice"),
      notes: optionalText(formData, "notes"),
      partner_id: partnerId,
      pay_type: String(formData.get("pay_type") ?? "none") as PartnerPayType,
    },
    { onConflict: "partner_id" },
  );
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: partnerId,
    entityType: "partner",
    eventType: "partner.pay_settings.update",
    metadata: {
      active: formData.get("active") === "on",
      flatPayPerInvoice: moneyValue(formData, "flat_pay_per_invoice"),
      invoicePercentage: moneyValue(formData, "invoice_percentage"),
      payType: String(formData.get("pay_type") ?? "none"),
    },
    summary: "Updated partner pay settings",
  });

  revalidatePath("/partners");
  revalidatePath("/partners", "layout");
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
}

export async function createPartner(formData: FormData) {
  const admin = await requireAdminProfile();

  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const clientId = String(formData.get("client_id") ?? "") || (await getDefaultClientId());

  if (!clientId) {
    return;
  }

  const { data: partner } = await supabase
    .from("partners")
    .insert({
    client_id: clientId,
    email: optionalText(formData, "email"),
    full_name: fullName,
    notes: optionalText(formData, "notes"),
    phone: optionalText(formData, "phone"),
    start_date: optionalDate(formData, "start_date"),
    status: (String(formData.get("status") ?? "active") as PartnerStatus) || "active",
    })
    .select("id")
    .single();

  if (partner) {
    await writeAdminAuditEvent({
      actorId: admin.id,
      entityId: partner.id,
      entityType: "partner",
      eventType: "partner.create",
      summary: `Created partner ${fullName}`,
    });
  }

  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function updatePartner(formData: FormData) {
  const admin = await requireAdminProfile();

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!id || !fullName) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("partners")
    .update({
      email: optionalText(formData, "email"),
      full_name: fullName,
      notes: optionalText(formData, "notes"),
      phone: optionalText(formData, "phone"),
      start_date: optionalDate(formData, "start_date"),
      status: String(formData.get("status") ?? "active") as PartnerStatus,
    })
    .eq("id", id);
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "partner",
    eventType: "partner.update",
    summary: `Updated partner ${fullName}`,
  });

  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function assignPartnerWorker(formData: FormData) {
  await requireAdminProfile();

  const partnerId = String(formData.get("partner_id") ?? "");
  const workerId = String(formData.get("worker_id") ?? "");

  if (!partnerId || !workerId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  await supabase
    .from("partner_worker_assignments")
    .update({ ended_at: today, status: "ended" })
    .eq("partner_id", partnerId)
    .eq("status", "active");

  await supabase.from("partner_worker_assignments").insert({
    assigned_at: optionalDate(formData, "assigned_at") ?? today,
    notes: optionalText(formData, "notes"),
    partner_id: partnerId,
    status: "active",
    worker_id: workerId,
  });

  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function removePartnerWorkerAssignment(formData: FormData) {
  await requireAdminProfile();

  const assignmentId = String(formData.get("assignment_id") ?? "");

  if (!assignmentId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  await supabase
    .from("partner_worker_assignments")
    .update({ ended_at: today, status: "ended" })
    .eq("id", assignmentId)
    .eq("status", "active");

  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function createPartnerInvoice(formData: FormData) {
  await requireAdminProfile();

  const partnerId = String(formData.get("partner_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
  const units = integerValue(formData, "units");
  const ratePerUnit = moneyValue(formData, "rate_per_unit");
  const invoiceTotal = moneyValue(formData, "invoice_total") || units * ratePerUnit;

  if (!partnerId || !clientId || !invoiceNumber) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("partner_invoices").insert({
    billing_period_end: String(formData.get("billing_period_end") ?? ""),
    billing_period_start: String(formData.get("billing_period_start") ?? ""),
    client_id: clientId,
    due_date: optionalDate(formData, "due_date"),
    invoice_number: invoiceNumber,
    invoice_total: invoiceTotal,
    balance_remaining: invoiceTotal,
    notes: optionalText(formData, "notes"),
    partner_id: partnerId,
    rate_per_unit: ratePerUnit,
    sent_date: optionalDate(formData, "sent_date"),
    status: String(formData.get("status") ?? "draft") as PartnerInvoiceStatus,
    units,
  });

  revalidatePath("/partners");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function generatePartnerInvoices(formData: FormData) {
  const admin = await requireAdminProfile();

  const clientId = String(formData.get("client_id") ?? "") || (await getDefaultClientId());
  const periodStart = String(formData.get("billing_period_start") ?? "");
  const periodEnd = String(formData.get("billing_period_end") ?? "");
  const notes = optionalText(formData, "notes");

  if (!clientId || !periodStart || !periodEnd || periodEnd < periodStart) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: client },
    { data: partners },
    { data: settings },
    { data: assignments },
    { data: units },
  ] =
    await Promise.all([
      supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
      supabase
        .from("partners")
        .select("id, client_id, full_name, status")
        .eq("client_id", clientId)
        .eq("status", "active"),
      supabase
        .from("partner_billing_settings")
        .select("partner_id, client_id, rate_per_unit, payment_terms_days, active")
        .eq("client_id", clientId)
        .eq("active", true),
      supabase
        .from("partner_worker_assignments")
        .select("partner_id, worker_id, assigned_at, ended_at, status")
        .lte("assigned_at", periodEnd)
        .or(`ended_at.is.null,ended_at.gte.${periodStart}`),
      supabase
        .from("production_units")
        .select("id, worker_id, quantity, work_date, status")
        .gte("work_date", periodStart)
        .lte("work_date", periodEnd)
        .eq("status", "approved"),
    ]);
  const invoicePrefix = getInvoicePrefix(client?.name);

  const partnerList = partners ?? [];
  const settingMap = new Map((settings ?? []).map((setting) => [setting.partner_id, setting]));
  const assignmentList = assignments ?? [];
  const unitList = units ?? [];
  const { data: activeUnitLinks } = unitList.length
    ? await supabase
        .from("production_unit_invoice_links")
        .select("production_unit_id, invoice_id, partner_invoices(invoice_number)")
        .in(
          "production_unit_id",
          unitList.map((unit) => unit.id),
        )
        .is("released_at", null)
    : { data: [] };
  const invoicedUnitIds = new Set(
    (activeUnitLinks ?? []).map((link) => link.production_unit_id),
  );
  const activeLinkByUnitId = new Map(
    (activeUnitLinks ?? []).map((link) => [link.production_unit_id, link] as const),
  );
  const now = new Date().toISOString();
  const { data: invoiceRun } = await supabase
    .from("invoice_runs")
    .upsert(
      {
        billing_period_end: periodEnd,
        billing_period_start: periodStart,
        client_id: clientId,
        generated_by: admin.id,
        notes,
        status: "ready",
      },
      { onConflict: "client_id,billing_period_start,billing_period_end" },
    )
    .select("id")
    .single();

  if (!invoiceRun) {
    return;
  }

  let invoiceCount = 0;
  let totalUnits = 0;
  let totalAmount = 0;

  for (const [index, partner] of partnerList.entries()) {
    const billing = settingMap.get(partner.id);

    if (!billing) {
      continue;
    }

    const { data: existingInvoice } = await supabase
      .from("partner_invoices")
      .select("id, status, total_paid")
      .eq("partner_id", partner.id)
      .eq("billing_period_start", periodStart)
      .eq("billing_period_end", periodEnd)
      .is("voided_at", null)
      .neq("status", "cancelled")
      .maybeSingle();

    const partnerAssignments = assignmentList.filter(
      (assignment) => assignment.partner_id === partner.id,
    );
    const billableUnits = unitList.filter(
      (unit) => {
        const activeLink = activeLinkByUnitId.get(unit.id);

        return (
          (!invoicedUnitIds.has(unit.id) || activeLink?.invoice_id === existingInvoice?.id) &&
        partnerAssignments.some(
        (assignment) =>
          assignment.worker_id === unit.worker_id &&
          assignment.assigned_at <= unit.work_date &&
          (!assignment.ended_at || assignment.ended_at >= unit.work_date),
          )
        );
      },
    );
    const unitsByDate = new Map<
      string,
      {
        units: number;
        workerId: string | null;
        unitRows: Array<{ id: string; quantity: number; worker_id: string; work_date: string }>;
      }
    >();

    for (const unit of billableUnits) {
      const existing = unitsByDate.get(unit.work_date) ?? {
        units: 0,
        workerId: unit.worker_id,
        unitRows: [],
      };

      unitsByDate.set(unit.work_date, {
        units: existing.units + unit.quantity,
        workerId: existing.workerId ?? unit.worker_id,
        unitRows: [
          ...existing.unitRows,
          {
            id: unit.id,
            quantity: unit.quantity,
            work_date: unit.work_date,
            worker_id: unit.worker_id,
          },
        ],
      });
    }

    const unitsTotal = Array.from(unitsByDate.values()).reduce(
      (total, value) => total + value.units,
      0,
    );

    if (unitsTotal <= 0) {
      continue;
    }

    const ratePerUnit = Number(billing.rate_per_unit ?? 0);
    const invoiceTotal = Math.round(unitsTotal * ratePerUnit * 100) / 100;
    const invoiceNumber = `${invoicePrefix}-${periodStart.replaceAll("-", "")}-${periodEnd.replaceAll("-", "")}-${String(index + 1).padStart(3, "0")}`;
    const dueDate = addDaysToDateKey(periodEnd, Number(billing.payment_terms_days ?? 15));
    let invoice: { id: string } | null = existingInvoice ? { id: existingInvoice.id } : null;

    if (existingInvoice && ["draft", "ready"].includes(existingInvoice.status)) {
      const totalPaid = Number(existingInvoice.total_paid ?? 0);

      const { data: updatedInvoice } = await supabase
        .from("partner_invoices")
        .update({
          balance_remaining: Math.max(0, invoiceTotal - totalPaid),
          client_id: clientId,
          due_date: dueDate,
          generated_at: now,
          invoice_number: invoiceNumber,
          invoice_run_id: invoiceRun.id,
          invoice_total: invoiceTotal,
          notes: "Generated from Partner worker unit entries.",
          rate_per_unit: ratePerUnit,
          status: "draft",
          total_paid: totalPaid,
          units: unitsTotal,
        })
        .eq("id", existingInvoice.id)
        .select("id")
        .single();

      invoice = updatedInvoice;
    } else if (existingInvoice) {
      continue;
    } else {
      const { data: createdInvoice } = await supabase
        .from("partner_invoices")
        .insert({
          balance_remaining: invoiceTotal,
          billing_period_end: periodEnd,
          billing_period_start: periodStart,
          client_id: clientId,
          due_date: dueDate,
          generated_at: now,
          invoice_number: invoiceNumber,
          invoice_run_id: invoiceRun.id,
          invoice_total: invoiceTotal,
          notes: "Generated from Partner worker unit entries.",
          partner_id: partner.id,
          rate_per_unit: ratePerUnit,
          status: "draft",
          total_paid: 0,
          units: unitsTotal,
        })
        .select("id")
        .single();

      invoice = createdInvoice;
    }

    if (!invoice) {
      continue;
    }

    await supabase
      .from("production_unit_invoice_links")
      .update({
        release_reason: "Regenerated invoice preview",
        released_at: now,
        released_by: admin.id,
      })
      .eq("invoice_id", invoice.id)
      .is("released_at", null);

    await supabase
      .from("partner_invoice_lines")
      .delete()
      .eq("invoice_id", invoice.id)
      .eq("source", "generated");

    for (const [workDate, value] of unitsByDate.entries()) {
      const { data: line } = await supabase
        .from("partner_invoice_lines")
        .insert({
        description: `Units completed on ${workDate}`,
        invoice_id: invoice.id,
        line_total: Math.round(value.units * ratePerUnit * 100) / 100,
        partner_id: partner.id,
        rate_per_unit: ratePerUnit,
        units: value.units,
        work_date: workDate,
        worker_id: value.workerId,
        source: "generated",
        })
        .select("id")
        .single();

      if (line) {
        await supabase.from("production_unit_invoice_links").insert(
          value.unitRows.map((unit) => ({
            created_by: admin.id,
            invoice_id: invoice.id,
            invoice_line_id: line.id,
            invoice_run_id: invoiceRun.id,
            partner_id: partner.id,
            production_unit_id: unit.id,
            quantity: unit.quantity,
            work_date: unit.work_date,
            worker_id: unit.worker_id,
          })),
        );
      }
    }

    const [{ data: allInvoiceLines }, { data: invoicePayments }] = await Promise.all([
      supabase
        .from("partner_invoice_lines")
        .select("units, line_total")
        .eq("invoice_id", invoice.id),
      supabase
        .from("partner_invoice_payments")
        .select("amount_received")
        .eq("invoice_id", invoice.id)
        .is("voided_at", null),
    ]);
    const finalUnits = (allInvoiceLines ?? []).reduce(
      (total, line) => total + Number(line.units),
      0,
    );
    const finalInvoiceTotal = Math.round(
      (allInvoiceLines ?? []).reduce(
        (total, line) => total + Number(line.line_total),
        0,
      ) * 100,
    ) / 100;
    const finalPaid = (invoicePayments ?? []).reduce(
      (total, payment) => total + Number(payment.amount_received),
      0,
    );

    await supabase
      .from("partner_invoices")
      .update({
        balance_remaining: Math.max(0, finalInvoiceTotal - finalPaid),
        invoice_total: finalInvoiceTotal,
        total_paid: finalPaid,
        units: finalUnits,
      })
      .eq("id", invoice.id);

    invoiceCount += 1;
    totalUnits += finalUnits;
    totalAmount += finalInvoiceTotal;
  }

  await supabase
    .from("invoice_runs")
    .update({
      invoice_count: invoiceCount,
      total_amount: Math.round(totalAmount * 100) / 100,
      total_units: totalUnits,
    })
    .eq("id", invoiceRun.id);

  revalidatePath("/partners");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function addPartnerInvoiceLine(formData: FormData) {
  await requireAdminProfile();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const workDate = optionalDate(formData, "work_date");
  const units = integerValue(formData, "units");
  const ratePerUnit = moneyValue(formData, "rate_per_unit");
  const lineTotal = moneyValue(formData, "line_total") || units * ratePerUnit;

  if (!invoiceId || !description || lineTotal < 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("id, invoice_run_id, partner_id, status")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    return;
  }

  if (!["draft", "ready"].includes(invoice.status)) {
    return;
  }

  await supabase.from("partner_invoice_lines").insert({
    description,
    invoice_id: invoiceId,
    line_total: lineTotal,
    partner_id: invoice.partner_id,
    rate_per_unit: ratePerUnit,
    source: "manual",
    units,
    work_date: workDate,
  });

  const { data: lines } = await supabase
    .from("partner_invoice_lines")
    .select("units, line_total")
    .eq("invoice_id", invoiceId);
  const { data: payments } = await supabase
    .from("partner_invoice_payments")
    .select("amount_received")
    .eq("invoice_id", invoiceId)
    .is("voided_at", null);
  const totalUnits = (lines ?? []).reduce((total, line) => total + Number(line.units), 0);
  const invoiceTotal = (lines ?? []).reduce(
    (total, line) => total + Number(line.line_total),
    0,
  );
  const totalPaid = (payments ?? []).reduce(
    (total, payment) => total + Number(payment.amount_received),
    0,
  );

  await supabase
    .from("partner_invoices")
    .update({
      balance_remaining: Math.max(0, invoiceTotal - totalPaid),
      invoice_total: Math.round(invoiceTotal * 100) / 100,
      status: totalPaid > 0 ? getInvoiceStatus(invoiceTotal, totalPaid) : invoice.status,
      total_paid: totalPaid,
      units: totalUnits,
    })
    .eq("id", invoiceId);

  await updateInvoiceRunTotals(invoice.invoice_run_id);

  revalidatePath("/invoices");
  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function updatePartnerInvoiceLine(formData: FormData) {
  await requireAdminProfile();

  const lineId = String(formData.get("line_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const workDate = optionalDate(formData, "work_date");
  const units = integerValue(formData, "units");
  const ratePerUnit = moneyValue(formData, "rate_per_unit");
  const lineTotal = moneyValue(formData, "line_total") || units * ratePerUnit;

  if (!lineId || !description || lineTotal < 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: line } = await supabase
    .from("partner_invoice_lines")
    .select("invoice_id, partner_invoices(status)")
    .eq("id", lineId)
    .single();

  if (!line) {
    return;
  }

  const invoiceStatus = Array.isArray(line.partner_invoices)
    ? line.partner_invoices[0]?.status
    : line.partner_invoices?.status;

  if (!["draft", "ready"].includes(String(invoiceStatus))) {
    return;
  }

  await supabase
    .from("partner_invoice_lines")
    .update({
      description,
      line_total: lineTotal,
      rate_per_unit: ratePerUnit,
      units,
      work_date: workDate,
    })
    .eq("id", lineId);

  await recalculatePartnerInvoice(line.invoice_id);

  revalidatePath("/invoices");
  revalidatePath("/partners");
}

export async function deletePartnerInvoiceLine(formData: FormData) {
  await requireAdminProfile();

  const lineId = String(formData.get("line_id") ?? "");

  if (!lineId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: line } = await supabase
    .from("partner_invoice_lines")
    .select("invoice_id, partner_invoices(status)")
    .eq("id", lineId)
    .single();

  if (!line) {
    return;
  }

  const invoiceStatus = Array.isArray(line.partner_invoices)
    ? line.partner_invoices[0]?.status
    : line.partner_invoices?.status;

  if (!["draft", "ready"].includes(String(invoiceStatus))) {
    return;
  }

  await supabase.from("partner_invoice_lines").delete().eq("id", lineId);
  await recalculatePartnerInvoice(line.invoice_id);

  revalidatePath("/invoices");
  revalidatePath("/partners");
}

async function recalculatePartnerInvoice(invoiceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("id, invoice_run_id, status")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    return;
  }

  const [{ data: lines }, { data: payments }] = await Promise.all([
    supabase
      .from("partner_invoice_lines")
      .select("units, line_total")
      .eq("invoice_id", invoiceId),
      supabase
        .from("partner_invoice_payments")
        .select("amount_received")
        .eq("invoice_id", invoiceId)
        .is("voided_at", null),
  ]);
  const totalUnits = (lines ?? []).reduce((total, line) => total + Number(line.units), 0);
  const invoiceTotal = Math.round(
    (lines ?? []).reduce((total, line) => total + Number(line.line_total), 0) * 100,
  ) / 100;
  const totalPaid = (payments ?? []).reduce(
    (total, payment) => total + Number(payment.amount_received),
    0,
  );

  await supabase
    .from("partner_invoices")
    .update({
      balance_remaining: Math.max(0, invoiceTotal - totalPaid),
      invoice_total: invoiceTotal,
      status:
        totalPaid > 0
          ? getInvoiceStatus(invoiceTotal, totalPaid)
          : ["partial", "paid"].includes(invoice.status)
            ? "sent"
            : invoice.status,
      total_paid: totalPaid,
      units: totalUnits,
    })
    .eq("id", invoiceId);

  await updateInvoiceRunTotals(invoice.invoice_run_id);
}

export async function finalizePartnerInvoice(formData: FormData) {
  await requireAdminProfile();

  const invoiceId = String(formData.get("invoice_id") ?? "");

  if (!invoiceId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("partner_invoices")
    .update({ status: "ready" })
    .eq("id", invoiceId)
    .eq("status", "draft");

  await createFlatPartnerPayrollFromInvoice(invoiceId);

  revalidatePath("/invoices");
  revalidatePath("/partners");
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
}

export async function markPartnerInvoiceSent(formData: FormData) {
  await requireAdminProfile();

  const invoiceId = String(formData.get("invoice_id") ?? "");

  if (!invoiceId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  await supabase
    .from("partner_invoices")
    .update({ sent_date: today, status: "sent" })
    .eq("id", invoiceId)
    .eq("status", "ready");

  revalidatePath("/invoices");
  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function deletePartnerInvoice(formData: FormData) {
  const admin = await requireAdminProfile();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const reason =
    optionalText(formData, "void_reason") ?? "Admin voided invoice for correction.";

  if (!invoiceId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("id, invoice_run_id, status, total_paid, voided_at")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.voided_at || invoice.status === "cancelled") {
    return;
  }

  const activePaid = await getActiveInvoicePaymentsTotal(invoiceId);

  if (activePaid > 0) {
    return;
  }

  const { data: partnerPayroll } = await supabase
    .from("partner_payrolls")
    .select("id, total_paid")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (partnerPayroll && Number(partnerPayroll.total_paid) > 0) {
    return;
  }

  if (partnerPayroll) {
    await supabase
      .from("partner_payrolls")
      .update({ balance_remaining: 0, status: "cancelled" })
      .eq("id", partnerPayroll.id);
  }

  const now = new Date().toISOString();

  await supabase
    .from("production_unit_invoice_links")
    .update({
      release_reason: reason,
      released_at: now,
      released_by: admin.id,
    })
    .eq("invoice_id", invoiceId)
    .is("released_at", null);

  await supabase
    .from("partner_invoices")
    .update({
      balance_remaining: 0,
      status: "cancelled",
      void_reason: reason,
      voided_at: now,
      voided_by: admin.id,
    })
    .eq("id", invoiceId);

  await supabase.from("invoice_recovery_events").insert({
    created_by: admin.id,
    event_type: "invoice_voided",
    invoice_id: invoiceId,
    invoice_run_id: invoice.invoice_run_id,
    reason,
  });
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: invoiceId,
    entityType: "partner_invoice",
    eventType: "partner_invoice.void",
    metadata: { reason },
    summary: "Voided partner invoice and released linked units",
  });

  await updateInvoiceRunTotals(invoice.invoice_run_id);

  revalidatePath("/invoices");
  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function voidPartnerInvoicePayment(formData: FormData) {
  const admin = await requireAdminProfile();

  const paymentId = String(formData.get("payment_id") ?? "");
  const reason =
    optionalText(formData, "void_reason") ?? "Admin voided payment for correction.";

  if (!paymentId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: payment } = await supabase
    .from("partner_invoice_payments")
    .select("id, invoice_id, voided_at")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.voided_at) {
    return;
  }

  const now = new Date().toISOString();

  await supabase
    .from("partner_invoice_payments")
    .update({
      void_reason: reason,
      voided_at: now,
      voided_by: admin.id,
    })
    .eq("id", paymentId);

  await supabase
    .from("financial_income_records")
    .update({
      void_reason: reason,
      voided_at: now,
      voided_by: admin.id,
    })
    .eq("invoice_payment_id", paymentId);

  await supabase.from("invoice_recovery_events").insert({
    created_by: admin.id,
    event_type: "payment_voided",
    invoice_id: payment.invoice_id,
    invoice_payment_id: paymentId,
    reason,
  });
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: paymentId,
    entityType: "partner_invoice_payment",
    eventType: "partner_invoice_payment.void",
    metadata: { invoiceId: payment.invoice_id, reason },
    summary: "Voided partner invoice payment",
  });

  await recalculatePartnerInvoice(payment.invoice_id);

  revalidatePath("/partners");
  revalidatePath("/invoices");
  revalidatePath("/income");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function recordPartnerPayrollPayment(formData: FormData) {
  const admin = await requireAdminProfile();

  const payrollId = String(formData.get("partner_payroll_id") ?? "");
  const amount = moneyValue(formData, "amount");
  const paidAt = optionalDate(formData, "paid_at");

  if (!payrollId || amount <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: payroll } = await supabase
    .from("partner_payrolls")
    .select("id, partner_id, total_owed, status")
    .eq("id", payrollId)
    .single();

  if (!payroll || payroll.status === "paid" || payroll.status === "cancelled") {
    return;
  }

  await supabase.from("partner_payroll_payments").insert({
    amount,
    created_by: admin.id,
    notes: optionalText(formData, "notes"),
    paid_at: paidAt ?? new Intl.DateTimeFormat("en-CA").format(new Date()),
    partner_id: payroll.partner_id,
    partner_payroll_id: payrollId,
  });

  const { data: payments } = await supabase
    .from("partner_payroll_payments")
    .select("amount")
    .eq("partner_payroll_id", payrollId);
  const totalPaid = (payments ?? []).reduce(
    (total, payment) => total + Number(payment.amount),
    0,
  );
  const totalOwed = Number(payroll.total_owed);

  await supabase
    .from("partner_payrolls")
    .update({
      balance_remaining: Math.max(0, totalOwed - totalPaid),
      status: getPartnerPayrollStatus(totalOwed, totalPaid),
      total_paid: totalPaid,
    })
    .eq("id", payrollId);
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: payrollId,
    entityType: "partner_payroll",
    eventType: "partner_payroll.payment.record",
    metadata: { amount, partnerId: payroll.partner_id },
    summary: `Recorded partner payroll payment for $${amount.toFixed(2)}`,
  });

  revalidatePath("/settlements");
  revalidatePath("/partners");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function markInvoiceRunSent(formData: FormData) {
  await requireAdminProfile();

  const invoiceRunId = String(formData.get("invoice_run_id") ?? "");

  if (!invoiceRunId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const { data: draftInvoices } = await supabase
    .from("partner_invoices")
    .select("id")
    .eq("invoice_run_id", invoiceRunId)
    .eq("status", "draft")
    .is("voided_at", null)
    .limit(1);

  if (draftInvoices?.length) {
    return;
  }

  await supabase
    .from("invoice_runs")
    .update({ sent_at: new Date().toISOString(), status: "sent" })
    .eq("id", invoiceRunId);

  await supabase
    .from("partner_invoices")
    .update({ sent_date: today, status: "sent" })
    .eq("invoice_run_id", invoiceRunId)
    .is("voided_at", null)
    .eq("status", "ready");

  revalidatePath("/partners");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function recordPartnerInvoicePayment(formData: FormData) {
  const admin = await requireAdminProfile();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const amountReceived = moneyValue(formData, "amount_received");

  if (!invoiceId || amountReceived <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const dateReceived =
    optionalDate(formData, "date_received") ??
    new Intl.DateTimeFormat("en-CA").format(new Date());

  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("id, partner_id, client_id, invoice_number, invoice_total, balance_remaining, status, voided_at")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.voided_at || invoice.status === "cancelled") {
    return;
  }

  if (Number(invoice.balance_remaining) <= 0) {
    return;
  }

  const paymentMethod = optionalText(formData, "payment_method");
  const depositAccount = optionalText(formData, "deposit_account");
  const notes = optionalText(formData, "notes");
  const { data: payment } = await supabase
    .from("partner_invoice_payments")
    .insert({
    amount_received: amountReceived,
    date_received: dateReceived,
    deposit_account: depositAccount,
    invoice_id: invoiceId,
    notes,
    partner_id: invoice.partner_id,
    payment_method: paymentMethod,
  })
    .select("id")
    .single();

  if (payment) {
    await supabase.from("financial_income_records").upsert(
      {
        amount: amountReceived,
        client_id: invoice.client_id,
        deposit_account: depositAccount,
        income_date: dateReceived,
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        invoice_payment_id: payment.id,
        notes,
        partner_id: invoice.partner_id,
        payment_method: paymentMethod,
        source: "invoice_payment",
      },
      { onConflict: "invoice_payment_id" },
    );
  }

  const { data: payments } = await supabase
    .from("partner_invoice_payments")
    .select("amount_received")
    .eq("invoice_id", invoiceId)
    .is("voided_at", null);
  const totalPaid = (payments ?? []).reduce(
    (total, payment) => total + Number(payment.amount_received),
    0,
  );
  const invoiceTotal = Number(invoice.invoice_total);
  const balanceRemaining = Math.max(0, invoiceTotal - totalPaid);

  await supabase
    .from("partner_invoices")
    .update({
      balance_remaining: balanceRemaining,
      status: getInvoiceStatus(invoiceTotal, totalPaid),
      total_paid: totalPaid,
    })
    .eq("id", invoiceId);
  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: payment?.id ?? invoiceId,
    entityType: "partner_invoice_payment",
    eventType: "partner_invoice_payment.record",
    metadata: { amountReceived, invoiceId, partnerId: invoice.partner_id },
    summary: `Recorded invoice payment for $${amountReceived.toFixed(2)}`,
  });

  revalidatePath("/partners");
  revalidatePath("/invoices");
  revalidatePath("/income");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function createPartnerSettlement(formData: FormData) {
  await requireAdminProfile();

  const partnerId = String(formData.get("partner_id") ?? "");

  if (!partnerId) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase.from("partner_settlements").insert({
    amount_partner_keeps: moneyValue(formData, "amount_partner_keeps"),
    amount_received_by_partner: moneyValue(formData, "amount_received_by_partner"),
    amount_transferred_to_scn: moneyValue(formData, "amount_transferred_to_scn"),
    invoice_id: optionalText(formData, "invoice_id"),
    notes: optionalText(formData, "notes"),
    partner_id: partnerId,
    transfer_date: optionalDate(formData, "transfer_date"),
    transfer_status: String(
      formData.get("transfer_status") ?? "pending",
    ) as PartnerSettlementStatus,
  });

  revalidatePath("/partners");
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
}

export async function uploadPartnerDocument(formData: FormData) {
  const admin = await requireAdminProfile();
  const partnerId = String(formData.get("partner_id") ?? "");
  const documentType = optionalText(formData, "document_type");
  const notes = optionalText(formData, "notes");
  const file = formData.get("file");

  if (!partnerId || !(file instanceof File) || file.size === 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${partnerId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("partner-documents")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return;
  }

  await supabase.from("partner_documents").insert({
    document_type: documentType,
    file_name: file.name,
    notes,
    partner_id: partnerId,
    storage_path: storagePath,
    uploaded_by: admin.id,
  });

  revalidatePath("/partners");
  revalidatePath("/documents");
}
