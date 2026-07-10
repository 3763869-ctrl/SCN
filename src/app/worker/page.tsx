import { SignOutButton } from "@/features/auth/sign-out-button";
import { requireProfile } from "@/features/auth/session";
import { WorkerDashboard } from "@/features/worker/worker-dashboard";
import { getWorkerDashboardData } from "@/features/worker/metrics";

export default async function WorkerPage() {
  const profile = await requireProfile();
  const dashboard = await getWorkerDashboardData(profile.id);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
              SCN
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
          workerName={profile.full_name ?? profile.email}
        />
      </section>
    </main>
  );
}
