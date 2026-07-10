"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (mode === "sign-up") {
      setMessage("Account created. Check your email if confirmation is enabled.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="grid grid-cols-2 rounded-md bg-surface-muted p-1">
        <button
          type="button"
          className={`rounded px-3 py-2 text-sm font-semibold ${
            mode === "sign-in" ? "bg-surface shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setMode("sign-in")}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`rounded px-3 py-2 text-sm font-semibold ${
            mode === "sign-up" ? "bg-surface shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setMode("sign-up")}
        >
          Sign Up
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
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
          {mode === "sign-in" ? "Sign In" : "Create Account"}
        </Button>
      </form>
    </div>
  );
}
