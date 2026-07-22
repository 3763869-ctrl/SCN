import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth/auth-form";
import { getCurrentProfile, getRoleHome } from "@/features/auth/session";

export default async function LoginPage() {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(getRoleHome(profile.role));
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="max-w-xl">
          <span className="grid h-12 w-12 place-items-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
            RM Support
          </span>
          <h1 className="mt-8 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
            Contractor Manager
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Secure access for managing clients, workers, time, production,
            payroll, invoicing, expenses, taxes, and reporting.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center border-t border-border bg-surface px-6 py-12 lg:border-l lg:border-t-0">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Access Workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in with the email and password provided by an administrator.
            </p>
          </div>
          <AuthForm />
        </div>
      </section>
    </main>
  );
}
