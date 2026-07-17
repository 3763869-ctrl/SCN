import { NextResponse, type NextRequest } from "next/server";

import { requireProfile } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const profile = await requireProfile();
  const { checkId } = (await request.json()) as { checkId?: string };

  if (!checkId) {
    return NextResponse.json({ error: "Missing check id." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: check } = await supabase
    .from("worker_presence_checks")
    .select("id, status, expires_at")
    .eq("id", checkId)
    .eq("worker_id", profile.id)
    .maybeSingle();

  if (!check) {
    return NextResponse.json({ error: "Check not found." }, { status: 404 });
  }

  if (!["scheduled", "sent"].includes(check.status)) {
    return NextResponse.json({ ok: true, status: check.status });
  }

  if (new Date(check.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, status: "expired" }, { status: 409 });
  }

  await supabase
    .from("worker_presence_checks")
    .update({
      responded_at: new Date().toISOString(),
      status: "answered",
    })
    .eq("id", check.id)
    .eq("worker_id", profile.id);

  return NextResponse.json({ ok: true, status: "answered" });
}
