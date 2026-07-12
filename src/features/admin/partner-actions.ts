"use server";

import { revalidatePath } from "next/cache";

import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PartnerInvoiceStatus,
  PartnerSettlementStatus,
  PartnerStatus,
} from "@/types/database";

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

async function getDefaultClientId() {
  const supabase = await createSupabaseServerClient();
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("name", "MS Support")
    .maybeSingle();

  if (existingClient?.id) {
    return existingClient.id;
  }

  const { data: createdClient } = await supabase
    .from("clients")
    .insert({
      name: "MS Support",
      notes: "Initial client for partner production work.",
      status: "active",
    })
    .select("id")
    .single();

  return createdClient?.id ?? "";
}

export async function createPartner(formData: FormData) {
  await requireAdminProfile();

  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const clientId = String(formData.get("client_id") ?? "") || (await getDefaultClientId());

  if (!clientId) {
    return;
  }

  await supabase.from("partners").insert({
    client_id: clientId,
    email: optionalText(formData, "email"),
    full_name: fullName,
    notes: optionalText(formData, "notes"),
    phone: optionalText(formData, "phone"),
    start_date: optionalDate(formData, "start_date"),
    status: (String(formData.get("status") ?? "active") as PartnerStatus) || "active",
  });

  revalidatePath("/partners");
  revalidatePath("/dashboard");
}

export async function updatePartner(formData: FormData) {
  await requireAdminProfile();

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

export async function recordPartnerInvoicePayment(formData: FormData) {
  await requireAdminProfile();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const partnerId = String(formData.get("partner_id") ?? "");
  const amountReceived = moneyValue(formData, "amount_received");

  if (!invoiceId || !partnerId || amountReceived <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const dateReceived =
    optionalDate(formData, "date_received") ??
    new Intl.DateTimeFormat("en-CA").format(new Date());

  await supabase.from("partner_invoice_payments").insert({
    amount_received: amountReceived,
    date_received: dateReceived,
    deposit_account: optionalText(formData, "deposit_account"),
    invoice_id: invoiceId,
    notes: optionalText(formData, "notes"),
    partner_id: partnerId,
    payment_method: optionalText(formData, "payment_method"),
  });

  await supabase.from("partner_invoices").update({ status: "paid" }).eq("id", invoiceId);

  revalidatePath("/partners");
  revalidatePath("/invoices");
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
