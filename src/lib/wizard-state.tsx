"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import type { CopyChunkResult, DataTreeRow } from "@/lib/sitecore/types";

// ---------------------------------------------------------------------------
// Persisted wizard state
// ---------------------------------------------------------------------------

export interface WizardConfig {
  sourceHost: string;
  destHost: string;
  database: string;
}

/** Per-chunkset progress captured during the streaming step. */
export interface ChunkSetProgress {
  chunksetId: string;
  chunkCount: number;
  totalItemCount: number;
  chunksDone: number;
  itemsProcessed: number;
  itemsSkipped: number;
  raifFileName?: string;
  /** Optional friendly label for this chunk set's .raif (overrides the run label). */
  label?: string;
  error?: string;
  results: CopyChunkResult[];
}

/** Per-.raif consume progress captured during the consume step. */
export interface ConsumeProgress {
  raifFileName: string;
  transferId?: string;
  location?: string;
  error?: string;
}

export interface WizardState {
  step: number;
  /** Furthest step reached, so the stepper stays navigable after a reload. */
  maxReached: number;
  config: WizardConfig;
  transferId: string;
  /** Optional friendly label for the whole run; default for each .raif's label. */
  runLabel: string;
  dataTrees: DataTreeRow[];
  created: boolean;
  chunkSets: ChunkSetProgress[];
  consumes: ConsumeProgress[];
}

const STORAGE_KEY = "sitecore-transfer-wizard-v1";

function makeTransferId(): string {
  // crypto.randomUUID is available in modern browsers.
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function initialState(): WizardState {
  return {
    step: 0,
    maxReached: 0,
    config: { sourceHost: "", destHost: "", database: "master" },
    transferId: makeTransferId(),
    runLabel: "",
    dataTrees: [],
    created: false,
    chunkSets: [],
    consumes: [],
  };
}

/**
 * Resolves the friendly label to show for a given .raif file name:
 * the owning chunk set's own label if set, otherwise the run label.
 * Returns undefined when neither is set.
 */
export function labelForRaif(state: WizardState, raifFileName: string): string | undefined {
  const cs = state.chunkSets.find((c) => c.raifFileName === raifFileName);
  const label = (cs?.label ?? "").trim() || state.runLabel.trim();
  return label || undefined;
}

interface WizardContextValue {
  state: WizardState;
  hydrated: boolean;
  /** Go to a step, remembering the furthest step reached. */
  navigate: (step: number, stepCount: number) => void;
  update: (patch: Partial<WizardState>) => void;
  updateConfig: (patch: Partial<WizardConfig>) => void;
  setDataTrees: (rows: DataTreeRow[]) => void;
  regenerateTransferId: () => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount. This intentionally sets state inside an
  // effect: localStorage is unavailable during SSR, and a lazy initializer would cause
  // a hydration mismatch, so we read it post-mount and flag when ready.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...initialState(), ...(JSON.parse(raw) as WizardState) });
    } catch {
      /* ignore corrupt state */
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      hydrated,
      navigate: (step, stepCount) =>
        setState((s) => {
          const clamped = Math.max(0, Math.min(stepCount - 1, step));
          return { ...s, step: clamped, maxReached: Math.max(s.maxReached, clamped) };
        }),
      update,
      updateConfig: (patch) =>
        setState((s) => ({ ...s, config: { ...s.config, ...patch } })),
      setDataTrees: (rows) => update({ dataTrees: rows }),
      regenerateTransferId: () => update({ transferId: makeTransferId() }),
      reset: () => setState(initialState()),
    }),
    [state, hydrated, update],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within a WizardProvider");
  return ctx;
}

export { makeTransferId };
