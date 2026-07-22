"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, PartyPopper, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markBirthdaySeen } from "@/features/admin/worker-actions";

type BirthdayCardProps = {
  age: number | null;
  workerName: string;
};

export function BirthdayCard({ age, workerName }: BirthdayCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <main className="relative min-h-screen overflow-hidden bg-foreground px-4 py-10 text-white">
      <div className="absolute inset-0 opacity-25">
        {Array.from({ length: 24 }, (_, index) => (
          <span
            className="absolute h-16 w-10 animate-[float-up_4s_ease-in_forwards] rounded-full"
            key={index}
            style={{
              animationDelay: `${index * 80}ms`,
              background:
                index % 4 === 0
                  ? "#14b8a6"
                  : index % 4 === 1
                    ? "#f59e0b"
                    : index % 4 === 2
                      ? "#ef4444"
                      : "#60a5fa",
              bottom: `${-90 - (index % 5) * 24}px`,
              left: `${4 + ((index * 13) % 92)}%`,
            }}
          />
        ))}
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center text-center">
        <div className="rounded-lg border border-white/15 bg-white p-8 text-foreground shadow-2xl">
          <PartyPopper className="mx-auto h-16 w-16 text-accent" />
          <p className="mt-5 text-sm font-semibold uppercase text-muted-foreground">
            RM Support Operations
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Happy Birthday, {workerName}!
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Wishing you a great day and a year full of success, health, and good
            work. We are happy to have you on the team.
          </p>
          {age ? (
            <div className="mx-auto mt-6 grid h-24 w-24 place-items-center rounded-full bg-surface-muted">
              <span className="text-3xl font-semibold">{age}</span>
            </div>
          ) : null}
          <div className="mt-6 flex justify-center gap-3 text-accent">
            <Gift className="h-6 w-6" />
            <Sparkles className="h-6 w-6" />
            <Gift className="h-6 w-6" />
          </div>
          <Button
            className="mt-8 h-12 w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await markBirthdaySeen();
                router.refresh();
              });
            }}
            type="button"
          >
            Continue to Work
          </Button>
        </div>
      </section>
    </main>
  );
}
