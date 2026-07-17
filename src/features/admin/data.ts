import { getHoursBetween } from "@/features/worker/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileSummary = {
  id: string;
  full_name: string | null;
  email: string;
  role: "admin" | "worker";
  active: boolean;
  deleted_at?: string | null;
};

export function getProfileLabel(
  profile: Pick<ProfileSummary, "full_name" | "email"> | undefined,
) {
  return profile?.full_name || profile?.email || "Unknown worker";
}

export async function getAdminOperationsData() {
  const supabase = await createSupabaseServerClient();
  const [
    { data: profiles },
    { data: timeEntries },
    { data: unitEntries },
    { data: paySettings },
    { data: bonusTiers },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id, worker_id, clock_in_at, clock_out_at, notes, created_at")
      .order("clock_in_at", { ascending: false })
      .limit(50),
    supabase
      .from("production_units")
      .select("id, worker_id, quantity, work_date, status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("worker_pay_settings")
      .select("worker_id, hourly_rate, payroll_schedule, weekly_unit_goal, active"),
    supabase
      .from("bonus_tiers")
      .select("id, worker_id, threshold_units, bonus_amount, label, active")
      .order("threshold_units", { ascending: true }),
  ]);

  const profileList = (profiles ?? []) as ProfileSummary[];
  const profileMap = new Map(
    profileList.map((profile) => [profile.id, profile] as const),
  );
  const timeList = timeEntries ?? [];
  const unitList = unitEntries ?? [];
  const paySettingsList = paySettings ?? [];
  const bonusTierList = bonusTiers ?? [];
  const paySettingsMap = new Map(
    paySettingsList.map((setting) => [setting.worker_id, setting] as const),
  );

  return {
    profiles: profileList,
    profileMap,
    timeEntries: timeList,
    unitEntries: unitList,
    paySettings: paySettingsList,
    paySettingsMap,
    bonusTiers: bonusTierList,
    activeWorkers: profileList.filter(
      (profile) => profile.role === "worker" && profile.active,
    ).length,
    activeClockIns: timeList.filter((entry) => !entry.clock_out_at).length,
    pendingUnits: unitList
      .filter((entry) => entry.status === "pending")
      .reduce((total, entry) => total + entry.quantity, 0),
    recentHours: timeList.reduce(
      (total, entry) => total + getHoursBetween(entry.clock_in_at, entry.clock_out_at),
      0,
    ),
  };
}
