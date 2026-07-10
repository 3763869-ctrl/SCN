"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="grid h-10 w-10 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
