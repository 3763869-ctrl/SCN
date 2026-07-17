import { NextResponse } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  await supabase
    .from("time_breaks")
    .update({ break_end_at: now })
    .eq("worker_id", profile.id)
    .is("break_end_at", null);

  return NextResponse.json({ ok: true });
}
