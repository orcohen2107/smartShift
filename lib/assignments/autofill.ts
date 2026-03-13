/**
 * לוגיקת שיבוץ אוטומטי – מחשבת הצעות שיבוץ לפי אילוצים, עומס וגיוון שבועי.
 */

type ShiftRow = {
  id: string;
  date: string;
  type: string;
  required_count: number | null;
};

type WorkerRow = {
  id: string;
  full_name: string | null;
};

type ConstraintRow = {
  worker_id: string;
  date: string;
  type: string;
  status: string;
};

type AssignmentRow = {
  shift_id: string;
  worker_id: string;
};

export type ProposedAssignment = {
  shift_id: string;
  worker_id: string;
  shift_date: string;
  shift_type: string;
  worker_name: string;
};

type LastWeekAssignment = {
  worker_id: string;
  date: string;
  type: string;
};

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type AutofillParams = {
  shifts: ShiftRow[];
  workers: WorkerRow[];
  constraints: ConstraintRow[];
  currentAssignments: AssignmentRow[];
  lastWeekAssignments: LastWeekAssignment[];
  workerIds: Set<string>;
};

export function computeAutofillProposals(
  params: AutofillParams
): ProposedAssignment[] {
  const {
    shifts,
    workers,
    constraints,
    currentAssignments,
    lastWeekAssignments,
    workerIds,
  } = params;

  const workersById = new Map(workers.map((w) => [w.id, w]));

  // מפת: worker_id -> date -> Set<type> (אילוצים לא זמין)
  const constraintMap = new Map<string, Map<string, Set<string>>>();
  for (const c of constraints) {
    if (c.status !== 'unavailable') continue;
    if (!constraintMap.has(c.worker_id)) {
      constraintMap.set(c.worker_id, new Map());
    }
    const byDate = constraintMap.get(c.worker_id)!;
    if (!byDate.has(c.date)) byDate.set(c.date, new Set());
    byDate.get(c.date)!.add(c.type);
  }

  function hasUnavailableConstraint(
    workerId: string,
    date: string,
    shiftType: string
  ): boolean {
    const byDate = constraintMap.get(workerId);
    if (!byDate) return false;
    const types = byDate.get(date);
    if (!types) return false;
    if (shiftType === 'full_day') return types.size > 0;
    return types.has(shiftType);
  }

  // מפת: worker_id -> [(date, type), ...] – שיבוצים בשבוע שעבר
  const lastWeekByWorker = new Map<string, Set<string>>();
  for (const a of lastWeekAssignments) {
    const key = `${a.date}:${a.type}`;
    if (!lastWeekByWorker.has(a.worker_id)) {
      lastWeekByWorker.set(a.worker_id, new Set());
    }
    lastWeekByWorker.get(a.worker_id)!.add(key);
  }

  function hadSameSlotLastWeek(
    workerId: string,
    date: string,
    shiftType: string
  ): boolean {
    const keys = lastWeekByWorker.get(workerId);
    if (!keys) return false;
    return keys.has(`${date}:${shiftType}`);
  }

  const eligibleWorkers = workers.filter((w) => workerIds.has(w.id));

  const assignedByShift = new Map<string, Set<string>>();
  for (const a of currentAssignments) {
    if (!workerIds.has(a.worker_id)) continue;
    if (!assignedByShift.has(a.shift_id)) {
      assignedByShift.set(a.shift_id, new Set());
    }
    assignedByShift.get(a.shift_id)!.add(a.worker_id);
  }

  const workloadByWorker = new Map<string, number>();
  for (const a of currentAssignments) {
    if (!workerIds.has(a.worker_id)) continue;
    workloadByWorker.set(
      a.worker_id,
      (workloadByWorker.get(a.worker_id) ?? 0) + 1
    );
  }

  const datesAssignedByWorker = new Map<string, Set<string>>();
  for (const a of currentAssignments) {
    if (!workerIds.has(a.worker_id)) continue;
    const shift = shifts.find((s) => s.id === a.shift_id);
    if (!shift) continue;
    if (!datesAssignedByWorker.has(a.worker_id)) {
      datesAssignedByWorker.set(a.worker_id, new Set());
    }
    datesAssignedByWorker.get(a.worker_id)!.add(shift.date);
  }

  const proposed: ProposedAssignment[] = [];

  for (const shift of shifts) {
    const currentCount = assignedByShift.get(shift.id)?.size ?? 0;
    const required = shift.required_count ?? 1;
    const needed = Math.max(0, required - currentCount);
    const shiftType = shift.type as string;

    for (let i = 0; i < needed; i++) {
      const candidates = eligibleWorkers
        .filter((w) => {
          const alreadyInShift = assignedByShift.get(shift.id)?.has(w.id);
          if (alreadyInShift) return false;
          const alreadyThisDay =
            datesAssignedByWorker.get(w.id)?.has(shift.date) ?? false;
          if (alreadyThisDay) return false;
          return true;
        })
        .sort((a, b) => {
          const aConflict = hasUnavailableConstraint(
            a.id,
            shift.date,
            shiftType
          );
          const bConflict = hasUnavailableConstraint(
            b.id,
            shift.date,
            shiftType
          );
          if (aConflict !== bConflict) return aConflict ? 1 : -1;
          const aLoad = workloadByWorker.get(a.id) ?? 0;
          const bLoad = workloadByWorker.get(b.id) ?? 0;
          if (aLoad !== bLoad) return aLoad - bLoad;
          // גיוון: העדפה למי שלא שובץ לאותו יום/משמרת בשבוע שעבר
          const aSame = hadSameSlotLastWeek(a.id, shift.date, shiftType);
          const bSame = hadSameSlotLastWeek(b.id, shift.date, shiftType);
          if (aSame !== bSame) return aSame ? 1 : -1;
          return 0;
        });

      const chosen = candidates[0];
      if (!chosen) break;

      proposed.push({
        shift_id: shift.id,
        worker_id: chosen.id,
        shift_date: shift.date,
        shift_type: shiftType,
        worker_name:
          workersById.get(chosen.id)?.full_name ?? chosen.id.slice(0, 8),
      });

      if (!assignedByShift.has(shift.id)) {
        assignedByShift.set(shift.id, new Set());
      }
      assignedByShift.get(shift.id)!.add(chosen.id);
      workloadByWorker.set(
        chosen.id,
        (workloadByWorker.get(chosen.id) ?? 0) + 1
      );
      if (!datesAssignedByWorker.has(chosen.id)) {
        datesAssignedByWorker.set(chosen.id, new Set());
      }
      datesAssignedByWorker.get(chosen.id)!.add(shift.date);
    }
  }

  return proposed;
}

export { addDays };
