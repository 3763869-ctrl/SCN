"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { AutoDismissToast } from "@/components/ui/auto-dismiss-toast";
import { Button } from "@/components/ui/button";

type SaveSubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  children: React.ReactNode;
  savingLabel?: string;
  successMessage?: string;
};

export function SaveSubmitButton({
  children,
  disabled,
  savingLabel = "Saving...",
  successMessage = "Saved successfully.",
  ...buttonProps
}: SaveSubmitButtonProps) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [showToast, setShowToast] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }

    if (wasPending.current) {
      wasPending.current = false;
      window.setTimeout(() => {
        setToastKey((value) => value + 1);
        setShowToast(true);
      }, 0);
    }
  }, [pending]);

  return (
    <>
      <Button
        {...buttonProps}
        disabled={disabled || pending}
        onClick={(event) => {
          setShowToast(false);
          buttonProps.onClick?.(event);
        }}
        type="submit"
      >
        {pending ? savingLabel : children}
      </Button>
      {showToast ? (
        <AutoDismissToast key={toastKey} paramsToClear={[]}>
          {successMessage}
        </AutoDismissToast>
      ) : null}
    </>
  );
}
