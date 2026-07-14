"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

import {
  sendPasswordReset,
  signIn,
  type AuthActionState,
} from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = {
  message: null,
};

function SignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Sign In
    </Button>
  );
}

function ForgotPasswordButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="text-sm font-medium text-accent transition hover:text-teal-800 disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Sending reset link..." : "Forgot Password"}
    </button>
  );
}

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [signInState, signInAction] = useActionState(signIn, initialState);
  const [resetState, resetAction] = useActionState(sendPasswordReset, initialState);
  const message = signInState.message ?? resetState.message;

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <form className="space-y-4" action={signInAction}>
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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

        <SignInButton />
      </form>

      <form className="mt-4" action={resetAction}>
        <input type="hidden" name="email" value={email} />
        <ForgotPasswordButton />
      </form>
    </div>
  );
}
