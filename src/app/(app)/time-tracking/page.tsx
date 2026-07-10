import { PageHeader } from "@/components/layout/page-header";
import {
  getAdminOperationsData,
  getProfileLabel,
} from "@/features/admin/data";
import { getHoursBetween } from "@/features/worker/metrics";

export default async function TimeTrackingPage() {
  const operations = await getAdminOperationsData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Tracking"
        description="Review worker clock activity and recent attendance records."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Open Clocks
          </p>
          <p className="mt-4 text-2xl font-semibold">
            {operations.activeClockIns}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Recent Entries
          </p>
          <p className="mt-4 text-2xl font-semibold">
            {operations.timeEntries.length}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Recent Hours
          </p>
          <p className="mt-4 text-2xl font-semibold">
            {operations.recentHours.toFixed(2)}
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Recent Time Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Worker</th>
                <th className="px-5 py-3 font-medium">Clock In</th>
                <th className="px-5 py-3 font-medium">Clock Out</th>
                <th className="px-5 py-3 font-medium">Hours</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {operations.timeEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-5 py-3 font-medium">
                    {getProfileLabel(operations.profileMap.get(entry.worker_id))}
                  </td>
                  <td className="px-5 py-3">
                    {new Date(entry.clock_in_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {entry.clock_out_at
                      ? new Date(entry.clock_out_at).toLocaleString()
                      : "Active"}
                  </td>
                  <td className="px-5 py-3">
                    {getHoursBetween(entry.clock_in_at, entry.clock_out_at).toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold">
                      {entry.clock_out_at ? "Closed" : "Open"}
                    </span>
                  </td>
                </tr>
              ))}
              {!operations.timeEntries.length ? (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={5}>
                    No time entries have been submitted yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
