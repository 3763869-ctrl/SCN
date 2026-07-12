import Link from "next/link";

import { Button } from "@/components/ui/button";
import { submitWorkerOnboarding } from "@/features/admin/worker-actions";
import { getAgeFromDateOfBirth } from "@/lib/dates/birthday";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type WorkerOnboardingPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ status?: string }>;
};

export default async function WorkerOnboardingPage({
  params,
  searchParams,
}: WorkerOnboardingPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = createSupabaseAdminClient();
  const { data: link } = await supabase
    .from("worker_onboarding_links")
    .select("id, worker_id, expires_at, completed_at")
    .eq("token", token)
    .maybeSingle();
  const currentTime = new Date().getTime();
  const linkExpired = Boolean(
    link?.expires_at && new Date(link.expires_at).getTime() < currentTime,
  );

  if (query?.status === "complete") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Thank you</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your worker information was submitted.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-accent" href="/login">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  if (
    query?.status === "expired" ||
    !link ||
    link.completed_at ||
    linkExpired
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">This link is no longer active</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Please contact SCN for a new worker information link.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-accent" href="/login">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  const [{ data: profile }, { data: details }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", link.worker_id)
      .maybeSingle(),
    supabase
      .from("worker_details")
      .select(
        "phone_number, date_of_birth, address_line1, city, state, country, zip_code, secondary_contact_name, secondary_contact_phone, hiring_source, referral_name",
      )
      .eq("worker_id", link.worker_id)
      .maybeSingle(),
  ]);
  const age = getAgeFromDateOfBirth(details?.date_of_birth);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground">
          SCN Contractor Manager
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Worker Information</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {profile?.full_name || profile?.email || "Worker"}, please complete your
          contact and hiring information.
        </p>

        <form action={submitWorkerOnboarding} className="mt-6 grid gap-4 md:grid-cols-2">
          <input name="token" type="hidden" value={token} />
          <label className="text-sm font-medium">
            Phone Number
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.phone_number ?? ""}
              name="phone_number"
              type="tel"
            />
          </label>
          <label className="text-sm font-medium">
            Date of Birth
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.date_of_birth ?? ""}
              name="date_of_birth"
              type="date"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Age: {age ?? "Not recorded"}
            </span>
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Address
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.address_line1 ?? ""}
              name="address_line1"
              type="text"
            />
          </label>
          <label className="text-sm font-medium">
            City
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.city ?? ""}
              name="city"
              type="text"
            />
          </label>
          <label className="text-sm font-medium">
            State
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.state ?? ""}
              name="state"
              type="text"
            />
          </label>
          <label className="text-sm font-medium">
            Country
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.country ?? ""}
              name="country"
              type="text"
            />
          </label>
          <label className="text-sm font-medium">
            ZIP
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.zip_code ?? ""}
              name="zip_code"
              type="text"
            />
          </label>
          <label className="text-sm font-medium">
            2nd Contact Name
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.secondary_contact_name ?? ""}
              name="secondary_contact_name"
              type="text"
            />
          </label>
          <label className="text-sm font-medium">
            2nd Contact Phone
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.secondary_contact_phone ?? ""}
              name="secondary_contact_phone"
              type="tel"
            />
          </label>
          <label className="text-sm font-medium">
            Hiring Source
            <select
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.hiring_source ?? ""}
              name="hiring_source"
            >
              <option value="">Not recorded</option>
              <option value="Referral">Referral</option>
              <option value="Indeed">Indeed</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Agency">Agency</option>
              <option value="Friend / Family">Friend / Family</option>
              <option value="Returning worker">Returning worker</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Referral Name
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
              defaultValue={details?.referral_name ?? ""}
              name="referral_name"
              type="text"
            />
          </label>
          <div className="md:col-span-2">
            <Button className="h-12 w-full" type="submit">
              Submit Information
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
