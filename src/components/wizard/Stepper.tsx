"use client";

import { STEPS } from "./steps";

export function Stepper({
  current,
  maxReached,
  onJump,
}: {
  current: number;
  maxReached: number;
  onJump: (step: number) => void;
}) {
  return (
    <nav aria-label="Progress">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const state = i === current ? "current" : i <= maxReached ? "done" : "todo";
          const reachable = i <= maxReached;
          return (
            <li key={s.short}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onJump(i)}
                className={[
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  state === "current"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : state === "done"
                      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950",
                  reachable ? "cursor-pointer" : "cursor-not-allowed",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    state === "current"
                      ? "bg-white text-blue-600"
                      : state === "done"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                {s.short}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
