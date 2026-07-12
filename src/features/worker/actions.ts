"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/features/auth/session";
import { getTodayBounds } from "@/features/worker/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkerActionState = {
  message: string | null;
  success?: boolean;
  bonusAmount?: number;
  bonusLabel?: string;
};

const initialState: WorkerActionState = {
  message: null,
};

export async function clockIn(): Promise<WorkerActionState> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data: openEntry } = await supabase
    .from("time_entries")
    .select("id")
    .eq("worker_id", profile.id)
    .is("clock_out_at", null)
    .maybeSingle();

  if (openEntry) {
    return { message: "You are already clocked in.", success: false };
  }

  await supabase.from("time_entries").insert({
    worker_id: profile.id,
  });

  revalidatePath("/worker");
  return { message: "Clocked in. Have a good shift.", success: true };
}

export async function startLunch(): Promise<WorkerActionState> {
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

  if (!openEntry) {
    return { message: "Clock in before starting lunch.", success: false };
  }

  const { data: openBreak } = await supabase
    .from("time_breaks")
    .select("id")
    .eq("worker_id", profile.id)
    .is("break_end_at", null)
    .maybeSingle();

  if (openBreak) {
    return { message: "Lunch pause is already running.", success: false };
  }

  await supabase.from("time_breaks").insert({
    worker_id: profile.id,
    time_entry_id: openEntry.id,
  });

  revalidatePath("/worker");
  return { message: "Lunch pause started.", success: true };
}

export async function endLunch(): Promise<WorkerActionState> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data: openBreak } = await supabase
    .from("time_breaks")
    .select("id")
    .eq("worker_id", profile.id)
    .is("break_end_at", null)
    .maybeSingle();

  if (!openBreak) {
    return { message: "There is no active lunch pause.", success: false };
  }

  await supabase
    .from("time_breaks")
    .update({ break_end_at: new Date().toISOString() })
    .eq("id", openBreak.id);

  revalidatePath("/worker");
  return { message: "Lunch pause ended.", success: true };
}

export async function clockOut(): Promise<WorkerActionState> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { workDate } = getTodayBounds();

  const { data: todaysUnits } = await supabase
    .from("production_units")
    .select("id")
    .eq("worker_id", profile.id)
    .eq("work_date", workDate)
    .limit(1);

  if (!todaysUnits?.length) {
    return {
      message: "Add today's units before clocking out.",
      success: false,
    };
  }

  await supabase
    .from("time_breaks")
    .update({ break_end_at: new Date().toISOString() })
    .eq("worker_id", profile.id)
    .is("break_end_at", null);

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
  return { message: "Clocked out for the day.", success: true };
}

export async function addUnits(
  _previousState: WorkerActionState = initialState,
  formData: FormData,
): Promise<WorkerActionState> {
  void _previousState;

  const profile = await requireProfile();
  const quantity = Number(formData.get("quantity"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { message: "Enter a valid unit quantity.", success: false };
  }

  const supabase = await createSupabaseServerClient();
  const { workDate } = getTodayBounds();
  const { data: existingUnits } = await supabase
    .from("production_units")
    .select("quantity")
    .eq("worker_id", profile.id)
    .eq("work_date", workDate);
  const previousUnits =
    existingUnits?.reduce((total, entry) => total + entry.quantity, 0) ?? 0;
  const nextUnits = previousUnits + Math.floor(quantity);

  await supabase.from("production_units").insert({
    worker_id: profile.id,
    quantity: Math.floor(quantity),
    work_date: workDate,
    notes: notes || null,
  });

  const { data: tiers } = await supabase
    .from("bonus_tiers")
    .select("threshold_units, bonus_amount, label")
    .or(`worker_id.is.null,worker_id.eq.${profile.id}`)
    .eq("active", true)
    .order("threshold_units", { ascending: true });
  const earnedTiers = (tiers ?? []).filter(
    (tier) =>
      previousUnits < tier.threshold_units && nextUnits >= tier.threshold_units,
  );
  const bonusAmount = earnedTiers.reduce(
    (total, tier) => total + Number(tier.bonus_amount),
    0,
  );

  revalidatePath("/worker");

  if (earnedTiers.length) {
    return {
      message: "Bonus goal reached.",
      success: true,
      bonusAmount,
      bonusLabel:
        earnedTiers.length === 1
          ? (earnedTiers[0].label ?? `${earnedTiers[0].threshold_units} units`)
          : `${earnedTiers.length} bonus goals reached`,
    };
  }

  return { message: "Units submitted.", success: true };
}
