"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/features/auth/session";
import { getTodayBounds } from "@/features/worker/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function clockIn() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data: openEntry } = await supabase
    .from("time_entries")
    .select("id")
    .eq("worker_id", profile.id)
    .is("clock_out_at", null)
    .maybeSingle();

  if (!openEntry) {
    await supabase.from("time_entries").insert({
      worker_id: profile.id,
    });
  }

  revalidatePath("/worker");
}

export async function clockOut() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data: openEntry } = await supabase
    .from("time_entries")
    .select("id")
    .eq("worker_id", profile.id)
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openEntry) {
    await supabase
      .from("time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", openEntry.id);
  }

  revalidatePath("/worker");
}

export async function addUnits(formData: FormData) {
  const profile = await requireProfile();
  const quantity = Number(formData.get("quantity"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { workDate } = getTodayBounds();

  await supabase.from("production_units").insert({
    worker_id: profile.id,
    quantity: Math.floor(quantity),
    work_date: workDate,
    notes: notes || null,
  });

  revalidatePath("/worker");
}
