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
import type { AssignmentsOverview } from "@/lib/utils/interfaces";

type AssignmentsContextValue = {
  overview: AssignmentsOverview | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  selectedBoardId: string | null;
  setSelectedBoardId: (id: string | null) => void;
  load: () => Promise<void>;
  updateOverview: (updater: (prev: AssignmentsOverview) => AssignmentsOverview) => void;
};

const AssignmentsContext = createContext<AssignmentsContextValue | null>(null);

// cache ברמת מודול – שורד גם כשהמרכיב נטען מחדש (מעבר טאבים)
let cachedOverview: AssignmentsOverview | null = null;
let cachedSelectedBoardId: string | null = null;

export function AssignmentsProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<AssignmentsOverview | null>(
    () => cachedOverview,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardIdState] = useState<string | null>(
    () => cachedSelectedBoardId,
  );

  const setSelectedBoardId = useCallback((id: string | null) => {
    cachedSelectedBoardId = id;
    setSelectedBoardIdState(id);
  }, []);

  const updateOverview = useCallback(
    (updater: (prev: AssignmentsOverview) => AssignmentsOverview) => {
      setOverview((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        cachedOverview = next;
        return next;
      });
    },
    [],
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<AssignmentsOverview>(
        "/api/assignments?type=all",
      );
      cachedOverview = data;
      setOverview(data);
      // ברירת מחדל: לוח אחרון שנוצר (הכי חדש)
      const boards = data.boards ?? [];
      const nextBoardId =
        boards.length === 0
          ? cachedSelectedBoardId
          : cachedSelectedBoardId && boards.some((b) => b.id === cachedSelectedBoardId)
            ? cachedSelectedBoardId
            : boards[boards.length - 1]!.id;
      cachedSelectedBoardId = nextBoardId;
      setSelectedBoardIdState(nextBoardId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      overview,
      loading,
      error,
      setError,
      selectedBoardId,
      setSelectedBoardId,
      load,
      updateOverview,
    }),
    [overview, loading, error, selectedBoardId, setSelectedBoardId, load, updateOverview],
  );

  return (
    <AssignmentsContext.Provider value={value}>
      {children}
    </AssignmentsContext.Provider>
  );
}

export function useAssignments() {
  const ctx = useContext(AssignmentsContext);
  if (!ctx) {
    throw new Error("useAssignments must be used within AssignmentsProvider");
  }
  return ctx;
}
