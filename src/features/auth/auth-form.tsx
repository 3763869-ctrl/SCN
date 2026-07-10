"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      await supabase.auth.signOut();
      setMessage("Your account is not active. Contact an administrator.");
      setIsSubmitting(false);
      return;
    }

    router.replace(profile.role === "admin" ? "/dashboard" : "/worker");
    router.refresh();
  }

  async function handleForgotPassword() {
    const emailInput = document.querySelector<HTMLInputElement>("#email");
    const email = emailInput?.value ?? "";

    if (!email) {
      setMessage("Enter your email first, then choose Forgot Password.");
      return;
    }

    setMessage(null);
    setIsResettingPassword(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    setIsResettingPassword(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("If this email is active, a password reset link has been sent.");
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {message ? (
          <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Sign In
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm font-medium text-accent transition hover:text-teal-800 disabled:opacity-50"
        onClick={handleForgotPassword}
        disabled={isResettingPassword}
      >
        {isResettingPassword ? "Sending reset link..." : "Forgot Password"}
      </button>
    </div>
  );
}
