"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAdminAuditEvent } from "@/features/admin/audit";
import { requireAdminProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PartnerStatus } from "@/types/database";

function cleanText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value || null;
}

function getClientStatus(formData: FormData): PartnerStatus {
  return formData.get("status") === "inactive" ? "inactive" : "active";
}

export async function createClient(formData: FormData) {
  const admin = await requireAdminProfile();

  const name = cleanText(formData, "name");

  if (!name) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .insert({
    name,
    notes: cleanText(formData, "notes"),
    status: getClientStatus(formData),
    })
    .select("id")
    .single();

  if (client) {
    await writeAdminAuditEvent({
      actorId: admin.id,
      entityId: client.id,
      entityType: "client",
      eventType: "client.create",
      summary: `Created client ${name}`,
    });
  }

  revalidatePath("/clients");
  revalidatePath("/settings");
  redirect("/clients");
}

export async function updateClient(formData: FormData) {
  const admin = await requireAdminProfile();

  const id = cleanText(formData, "client_id");
  const name = cleanText(formData, "name");

  if (!id || !name) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("clients")
    .update({
      name,
      notes: cleanText(formData, "notes"),
      status: getClientStatus(formData),
    })
    .eq("id", id);

  await writeAdminAuditEvent({
    actorId: admin.id,
    entityId: id,
    entityType: "client",
    eventType: "client.update",
    summary: `Updated client ${name}`,
  });

  revalidatePath("/clients");
  revalidatePath("/settings");
  revalidatePath("/partners");
  revalidatePath("/invoices");
  revalidatePath("/income");
  redirect("/clients");
}
