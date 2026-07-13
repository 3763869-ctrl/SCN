"use client";

import Link from "next/link";
import { Menu, Search, ShieldCheck } from "lucide-react";

import { navigationItems } from "@/components/layout/navigation";
import { SignOutButton } from "@/features/auth/sign-out-button";

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface text-muted-foreground shadow-sm transition hover:bg-surface-muted lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="hidden min-w-0 flex-1 items-center rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-inner sm:flex lg:max-w-xl">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          Search partners, workers, invoices
        </div>

        <nav className="flex gap-2 overflow-x-auto lg:hidden">
          {navigationItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 md:flex">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
            Protected
          </div>
          <SignOutButton />
          <div className="grid h-10 w-10 place-items-center rounded-md bg-foreground text-sm font-semibold text-white">
            ZW
          </div>
        </div>
      </div>
    </header>
  );
}
