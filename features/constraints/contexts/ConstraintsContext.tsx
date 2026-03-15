'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api/apiFetch';
import type { Constraint } from '@/lib/utils/interfaces';
import type { SystemMember } from '@/features/constraints/types';

type LoadOptions = { all?: boolean };

export type { SystemMember };

type ConstraintsContextValue = {
  constraints: Constraint[];
  setConstraints: React.Dispatch<React.SetStateAction<Constraint[]>>;
  systemMembers: SystemMember[];
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  load: (options?: LoadOptions) => Promise<void>;
  hasCachedData: boolean;
};

const ConstraintsContext = createContext<ConstraintsContextValue | null>(null);

// cache ברמת מודול – שורד גם כשהמרכיב נטען מחדש (מעבר טאבים)
let cachedConstraints: Constraint[] | null = null;
let cachedSystemMembers: SystemMember[] | null = null;

export function ConstraintsProvider({ children }: { children: ReactNode }) {
  const [constraints, setConstraints] = useState<Constraint[]>(
    () => cachedConstraints ?? []
  );
  const [systemMembers, setSystemMembers] = useState<SystemMember[]>(
    () => cachedSystemMembers ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: LoadOptions) => {
    setError(null);
    setLoading(true);
    try {
      const url =
        options?.all === true ? '/api/constraints?all=1' : '/api/constraints';
      const data = await apiFetch<{
        constraints: Constraint[];
        systemMembers?: SystemMember[];
      }>(url);
      cachedConstraints = data.constraints;
      setConstraints(data.constraints);
      if (data.systemMembers) {
        cachedSystemMembers = data.systemMembers;
        setSystemMembers(data.systemMembers);
      } else {
        cachedSystemMembers = null;
        setSystemMembers([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const setConstraintsAndCache = useCallback(
    (updater: React.SetStateAction<Constraint[]>) => {
      setConstraints((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        cachedConstraints = next;
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      constraints,
      setConstraints: setConstraintsAndCache,
      systemMembers,
      loading,
      error,
      setError,
      load,
      hasCachedData: cachedConstraints !== null,
    }),
    [constraints, setConstraintsAndCache, systemMembers, loading, error, load]
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
    throw new Error('useConstraints must be used within ConstraintsProvider');
  }
  return ctx;
}
