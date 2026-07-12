"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = {
  cancelLabel?: string;
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
  description: string;
  disabled?: boolean;
  name?: string;
  title: string;
  value?: string;
  variant?: "primary" | "secondary";
};

export function ConfirmSubmitButton({
  cancelLabel = "Cancel",
  children,
  className,
  confirmLabel = "Confirm",
  description,
  disabled,
  name,
  title,
  value,
  variant = "secondary",
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        className={className}
        disabled={disabled}
        name={name}
        onClick={(event) => {
          event.preventDefault();

          if (!disabled) {
            setOpen(true);
          }
        }}
        ref={submitButtonRef}
        type="submit"
        value={value}
        variant={variant}
      >
        {children}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            aria-modal="true"
            className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl"
            role="dialog"
          >
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                className="h-10"
                onClick={() => setOpen(false)}
                type="button"
                variant="secondary"
              >
                {cancelLabel}
              </Button>
              <Button
                className="h-10"
                onClick={() => {
                  setOpen(false);
                  submitButtonRef.current?.form?.requestSubmit(
                    submitButtonRef.current,
                  );
                }}
                type="button"
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
