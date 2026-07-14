"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEFAULT_PARAMS_TO_CLEAR = ["saved", "date"];

type AutoDismissToastProps = {
  children: ReactNode;
  dismissAfterMs?: number;
  paramsToClear?: string[];
};

export function AutoDismissToast({
  children,
  dismissAfterMs = 3500,
  paramsToClear = DEFAULT_PARAMS_TO_CLEAR,
}: AutoDismissToastProps) {
  const [visible, setVisible] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(false);

      if (paramsToClear.length > 0) {
        const nextParams = new URLSearchParams(searchParams.toString());
        paramsToClear.forEach((param) => nextParams.delete(param));
        const nextQuery = nextParams.toString();

        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
          scroll: false,
        });
      }
    }, dismissAfterMs);

    return () => window.clearTimeout(timeout);
  }, [dismissAfterMs, paramsToClear, pathname, router, searchParams]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg">
      {children}
    </div>
  );
}
