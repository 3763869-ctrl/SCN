import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type AuthProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  active: boolean;
  deleted_at: string | null;
};

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active || profile.deleted_at) {
    await supabase.auth.signOut();
    return null;
  }

  return profile satisfies AuthProfile;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireAdminProfile() {
  const profile = await requireProfile();

  if (profile.role === "worker") {
    redirect("/worker");
  }

  return profile;
}

export function getRoleHome(role: AppRole) {
  return role === "admin" ? "/dashboard" : "/worker";
}
