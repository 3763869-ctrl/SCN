"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} type="button" variant="secondary">
      <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
