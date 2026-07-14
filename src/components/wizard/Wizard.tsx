"use client";

import { useMemo } from "react";
import { useWizard } from "@/lib/wizard-state";
import { STEPS } from "./steps";
import { Stepper } from "./Stepper";
import { Button, Skeleton } from "@/components/ui";
import { Step0Configure } from "./Step0Configure";
import { Step1SelectContent } from "./Step1SelectContent";
import { Step2Create } from "./Step2Create";
import { Step3Monitor } from "./Step3Monitor";
import { Step4Stream } from "./Step4Stream";
import { Step5Consume } from "./Step5Consume";
import { Step6Summary } from "./Step6Summary";

export function Wizard() {
  const { state, hydrated, navigate } = useWizard();

  const canAdvance = useMemo(() => stepIsComplete(state), [state]);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const go = (next: number) => navigate(next, STEPS.length);

  const step = state.step;
  const maxReached = state.maxReached;
  const meta = STEPS[step];

  return (
    <div className="flex flex-col gap-6">
      <Stepper current={step} maxReached={maxReached} onJump={go} />

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{meta.title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{meta.description}</p>
      </div>

      <StepBody step={step} />

      <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <Button variant="secondary" onClick={() => go(step - 1)} disabled={step === 0}>
          ← Back
        </Button>
        <span className="text-xs text-zinc-400">
          Step {step + 1} of {STEPS.length}
        </span>
        <Button onClick={() => go(step + 1)} disabled={step === STEPS.length - 1 || !canAdvance}>
          Next →
        </Button>
      </div>
    </div>
  );
}

function StepBody({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <Step0Configure />;
    case 1:
      return <Step1SelectContent />;
    case 2:
      return <Step2Create />;
    case 3:
      return <Step3Monitor />;
    case 4:
      return <Step4Stream />;
    case 5:
      return <Step5Consume />;
    case 6:
      return <Step6Summary />;
    default:
      return null;
  }
}

/** Whether the current step's requirements are met to advance. */
function stepIsComplete(state: ReturnType<typeof useWizard>["state"]): boolean {
  switch (state.step) {
    case 0:
      return !!(state.config.sourceHost && state.config.destHost && state.config.database);
    case 1:
      return (
        state.dataTrees.length > 0 &&
        !!state.transferId &&
        state.dataTrees.every((r) => r.ItemPath.trim().length > 0)
      );
    case 2:
      return state.created;
    case 3:
      return state.chunkSets.length > 0;
    case 4:
      return state.chunkSets.length > 0 && state.chunkSets.every((c) => !!c.raifFileName);
    case 5:
      return state.consumes.length > 0;
    default:
      return true;
  }
}
