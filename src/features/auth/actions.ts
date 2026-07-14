"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRoleHome } from "@/features/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  message: string | null;
};

function cleanEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

function getOrigin() {
  return headers().then((headerStore) => {
    const origin = headerStore.get("origin");
    const host = headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") ?? "https";

    return origin || (host ? `${proto}://${host}` : "");
  });
}

function rateLimitMessage(resetAt: Date) {
  return `Too many attempts. Please try again after ${resetAt.toLocaleTimeString(
    "en-US",
    { hour: "numeric", minute: "2-digit" },
  )}.`;
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = cleanEmail(formData);
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Enter your email and password." };
  }

  const ip = await getClientIp();
  const limit = await checkRateLimit({
    key: `login:${ip}:${email}`,
    limit: 5,
    windowSeconds: 10 * 60,
  });

  if (!limit.allowed) {
    return { message: rateLimitMessage(limit.resetAt) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { message: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();

    return { message: "Your account is not active. Contact an administrator." };
  }

  redirect(getRoleHome(profile.role));
}

export async function sendPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = cleanEmail(formData);

  if (!email) {
    return { message: "Enter your email first, then choose Forgot Password." };
  }

  const ip = await getClientIp();
  const limit = await checkRateLimit({
    key: `password-reset:${ip}:${email}`,
    limit: 3,
    windowSeconds: 60 * 60,
  });

  if (!limit.allowed) {
    return { message: rateLimitMessage(limit.resetAt) };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/login` : undefined,
  });

  return {
    message: "If this email is active, a password reset link has been sent.",
  };
}
