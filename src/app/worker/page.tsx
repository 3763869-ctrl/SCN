import { SignOutButton } from "@/features/auth/sign-out-button";
import { requireProfile } from "@/features/auth/session";
import { BirthdayCard } from "@/features/worker/birthday-card";
import { WorkerDashboard } from "@/features/worker/worker-dashboard";
import { getWorkerDashboardData } from "@/features/worker/metrics";
import { getWorkerPhoneData } from "@/features/worker/phone-data";
import { getBirthdayDue } from "@/lib/dates/birthday";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WorkerPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: details } = await supabase
    .from("worker_details")
    .select("date_of_birth, birthday_last_shown_year")
    .eq("worker_id", profile.id)
    .maybeSingle();
  const birthday = getBirthdayDue(
    details?.date_of_birth,
    details?.birthday_last_shown_year,
  );

  if (profile.role === "worker" && birthday.due) {
    return (
      <BirthdayCard
        age={birthday.age}
        workerName={profile.full_name ?? profile.email}
      />
    );
  }

  const [dashboard, phone] = await Promise.all([
    getWorkerDashboardData(profile.id),
    getWorkerPhoneData(profile.id),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
              RM Support
            </span>
            <div>
              <p className="text-sm font-semibold">Worker Workspace</p>
              <p className="text-xs text-muted-foreground">
                {profile.full_name ?? profile.email}
              </p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <WorkerDashboard
          data={dashboard}
          phoneData={phone}
          workerName={profile.full_name ?? profile.email}
        />
      </section>
    </main>
  );
}
