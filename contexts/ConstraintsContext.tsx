"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import type { Constraint } from "@/lib/utils/interfaces";

type ConstraintsContextValue = {
  constraints: Constraint[];
  setConstraints: React.Dispatch<React.SetStateAction<Constraint[]>>;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  load: () => Promise<void>;
  hasCachedData: boolean;
};

const ConstraintsContext = createContext<ConstraintsContextValue | null>(null);

// cache ברמת מודול – שורד גם כשהמרכיב נטען מחדש (מעבר טאבים)
let cachedConstraints: Constraint[] | null = null;

export function ConstraintsProvider({ children }: { children: ReactNode }) {
  const [constraints, setConstraints] = useState<Constraint[]>(
    () => cachedConstraints ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ constraints: Constraint[] }>(
        "/api/constraints",
      );
      cachedConstraints = data.constraints;
      setConstraints(data.constraints);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const setConstraintsAndCache = useCallback(
    (updater: React.SetStateAction<Constraint[]>) => {
      setConstraints((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        cachedConstraints = next;
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      constraints,
      setConstraints: setConstraintsAndCache,
      loading,
      error,
      setError,
      load,
      hasCachedData: cachedConstraints !== null,
    }),
    [constraints, setConstraintsAndCache, loading, error, load],
  );

  return (
    <ConstraintsContext.Provider value={value}>
      {children}
    </ConstraintsContext.Provider>
  );
}

export function useConstraints() {
  const ctx = useContext(ConstraintsContext);
  if (!ctx) {
    throw new Error("useConstraints must be used within ConstraintsProvider");
  }
  return ctx;
}
