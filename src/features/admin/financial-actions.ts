"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FinancialExpenseCategory,
  FinancialRecurringFrequency,
} from "@/types/database";

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value || null;
}

function moneyValue(formData: FormData, name: string) {
  const value = Number(formData.get(name) ?? 0);

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function dateValue(formData: FormData, name: string) {
  return optionalText(formData, name) ?? new Intl.DateTimeFormat("en-CA").format(new Date());
}

function revalidateFinancialPages() {
  revalidatePath("/dashboard");
  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/partners");
}

function redirectAfterSave(formData: FormData, fallback: string): never {
  const redirectTo = String(formData.get("redirect_to") ?? "").trim();

  redirect(redirectTo.startsWith("/") ? redirectTo : fallback);
}

export async function createManualIncome(formData: FormData) {
  const admin = await requireAdminProfile();
  const amount = moneyValue(formData, "amount");

  if (amount <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  const { data: income } = await supabase
    .from("financial_income_records")
    .insert({
    amount,
    client_id: optionalText(formData, "client_id"),
    created_by: admin.id,
    deposit_account: optionalText(formData, "deposit_account"),
    income_date: dateValue(formData, "income_date"),
    invoice_number: optionalText(formData, "invoice_number"),
    notes: optionalText(formData, "notes"),
    partner_id: optionalText(formData, "partner_id"),
    payment_method: optionalText(formData, "payment_method"),
    source: "manual",
    })
    .select("id")
    .single();

  if (income) {
    await writeAdminAuditEvent({
      actorId: admin.id,
      entityId: income.id,
      entityType: "income",
      eventType: "income.create",
      metadata: { amount },
      summary: `Created manual income for $${amount.toFixed(2)}`,
    });
  }

  revalidateFinancialPages();
  redirectAfterSave(formData, "/income");
}

export async function updateIncome(formData: FormData) {
  const admin = await requireAdminProfile();
  const incomeId = String(formData.get("income_id") ?? "");
  const amount = moneyValue(formData, "amount");

  if (!incomeId || amount <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("financial_income_records")
    .update({
      amount,
      client_id: optionalText(formData, "client_id"),
      deposit_account: optionalText(formData, "deposit_account"),
      income_date: dateValue(formData, "income_date"),
      invoice_number: optionalText(formData, "invoice_number"),
      notes: optionalText(formData, "notes"),
      partner_id: optionalText(formData, "partner_id"),
      payment_method: optionalText(formData, "payment_method"),
    })
    .eq("id", incomeId);

  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: incomeId,
    entityType: "income",
    eventType: "income.update",
    metadata: { amount },
    summary: `Updated income record to $${amount.toFixed(2)}`,
  });

  revalidateFinancialPages();
  redirectAfterSave(formData, "/income");
}

export async function createExpense(formData: FormData) {
  const admin = await requireAdminProfile();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = moneyValue(formData, "amount");
  const file = formData.get("receipt");

  if (!vendor || !description || amount <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  let receiptFileName: string | null = null;
  let receiptStoragePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    receiptFileName = file.name;
    receiptStoragePath = `${admin.id}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("expense-receipts")
      .upload(receiptStoragePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      receiptFileName = null;
      receiptStoragePath = null;
    }
  }

  const { data: expense } = await supabase
    .from("financial_expenses")
    .insert({
    amount,
    category: String(formData.get("category") ?? "office_expenses") as FinancialExpenseCategory,
    created_by: admin.id,
    description,
    expense_date: dateValue(formData, "expense_date"),
    notes: optionalText(formData, "notes"),
    paid_from_account: optionalText(formData, "paid_from_account"),
    partner_id: optionalText(formData, "partner_id"),
    payment_method: optionalText(formData, "payment_method"),
    receipt_file_name: receiptFileName,
    receipt_storage_path: receiptStoragePath,
    recurring: formData.get("recurring") === "on",
    recurring_frequency: optionalText(formData, "recurring_frequency") as
      | FinancialRecurringFrequency
      | null,
    recurring_next_date: optionalText(formData, "recurring_next_date"),
    subcategory: optionalText(formData, "subcategory"),
    tax_deductible: formData.get("tax_deductible") === "on",
    vendor,
    worker_id: optionalText(formData, "worker_id"),
    })
    .select("id")
    .single();

  if (expense) {
    await writeAdminAuditEvent({
      actorId: admin.id,
      entityId: expense.id,
      entityType: "expense",
      eventType: "expense.create",
      metadata: { amount, vendor },
      summary: `Created expense for ${vendor} at $${amount.toFixed(2)}`,
    });
  }

  revalidateFinancialPages();
  redirectAfterSave(formData, "/expenses");
}

export async function updateExpense(formData: FormData) {
  const admin = await requireAdminProfile();
  const expenseId = String(formData.get("expense_id") ?? "");
  const vendor = String(formData.get("vendor") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = moneyValue(formData, "amount");
  const file = formData.get("receipt");

  if (!expenseId || !vendor || !description || amount <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const updates: {
    amount: number;
    category: FinancialExpenseCategory;
    description: string;
    expense_date: string;
    notes: string | null;
    paid_from_account: string | null;
    partner_id: string | null;
    payment_method: string | null;
    receipt_file_name?: string | null;
    receipt_storage_path?: string | null;
    recurring: boolean;
    recurring_frequency: FinancialRecurringFrequency | null;
    recurring_next_date: string | null;
    subcategory: string | null;
    tax_deductible: boolean;
    vendor: string;
    worker_id: string | null;
  } = {
    amount,
    category: String(formData.get("category") ?? "office_expenses") as FinancialExpenseCategory,
    description,
    expense_date: dateValue(formData, "expense_date"),
    notes: optionalText(formData, "notes"),
    paid_from_account: optionalText(formData, "paid_from_account"),
    partner_id: optionalText(formData, "partner_id"),
    payment_method: optionalText(formData, "payment_method"),
    recurring: formData.get("recurring") === "on",
    recurring_frequency: optionalText(formData, "recurring_frequency") as
      | FinancialRecurringFrequency
      | null,
    recurring_next_date: optionalText(formData, "recurring_next_date"),
    subcategory: optionalText(formData, "subcategory"),
    tax_deductible: formData.get("tax_deductible") === "on",
    vendor,
    worker_id: optionalText(formData, "worker_id"),
  };

  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${admin.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("expense-receipts")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (!error) {
      updates.receipt_file_name = file.name;
      updates.receipt_storage_path = storagePath;
    }
  }

  await supabase
    .from("financial_expenses")
    .update(updates)
    .eq("id", expenseId);

  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: expenseId,
    entityType: "expense",
    eventType: "expense.update",
    metadata: { amount, vendor },
    summary: `Updated expense for ${vendor} to $${amount.toFixed(2)}`,
  });

  revalidateFinancialPages();
  redirectAfterSave(formData, "/expenses");
}
