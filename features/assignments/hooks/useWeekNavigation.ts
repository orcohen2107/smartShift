import { useMemo, useState } from 'react';
import type { AssignmentsOverview, ShiftBoard } from '@/lib/utils/interfaces';
import { ShiftType } from '@/lib/utils/enums';
import { getWeekDates } from '@/features/assignments/utils';

export function useWeekNavigation(params: {
  overview: AssignmentsOverview | null;
  selectedBoardId: string | null;
  selectedBoard: ShiftBoard | null;
}) {
  const { overview, selectedBoardId, selectedBoard } = params;
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const datesInWeekSet = useMemo(() => new Set(weekDates), [weekDates]);

  const shiftIdsInWeek = useMemo(() => {
    const ids = new Set<string>();
    (overview?.shifts ?? []).forEach((s) => {
      if (
        datesInWeekSet.has(s.date) &&
        (!selectedBoardId || s.board_id === selectedBoardId)
      ) {
        ids.add(s.id);
      }
    });
    return ids;
  }, [overview?.shifts, datesInWeekSet, selectedBoardId]);

  const assignmentsInWeek = useMemo(
    () =>
      (overview?.assignments ?? []).filter((a) =>
        shiftIdsInWeek.has(a.shift_id)
      ),
    [overview?.assignments, shiftIdsInWeek]
  );

  const constraintsInWeek = useMemo(
    () =>
      (overview?.constraints ?? []).filter((c) => datesInWeekSet.has(c.date)),
    [overview?.constraints, datesInWeekSet]
  );

  const weeklyProgress = useMemo(() => {
    const datesSet = new Set(weekDates);
    let shiftsInWeek = (overview?.shifts ?? []).filter((s) =>
      datesSet.has(s.date)
    );
    if (selectedBoardId) {
      shiftsInWeek = shiftsInWeek.filter((s) => s.board_id === selectedBoardId);
    }
    const weekShiftIds = new Set(shiftsInWeek.map((s) => s.id));
    const weekAssignments = (overview?.assignments ?? []).filter((a) =>
      weekShiftIds.has(a.shift_id)
    );
    const isFullDay = selectedBoard?.single_person_for_day ?? false;
    let daysFullyAssigned = 0;
    for (const date of weekDates) {
      const dayShifts = shiftsInWeek.filter((s) => s.date === date);
      const relevantShifts = isFullDay
        ? dayShifts.filter((s) => s.type === ShiftType.FullDay)
        : dayShifts.filter(
            (s) => s.type === ShiftType.Day || s.type === ShiftType.Night
          );
      if (relevantShifts.length === 0) continue;
      const allFull = relevantShifts.every((s) => {
        const count = weekAssignments.filter((a) => a.shift_id === s.id).length;
        return count >= (s.required_count ?? 1);
      });
      if (allFull) daysFullyAssigned += 1;
    }
    return { daysFullyAssigned, total: 7 };
  }, [
    weekDates,
    selectedBoardId,
    selectedBoard?.single_person_for_day,
    overview?.shifts,
    overview?.assignments,
  ]);

  return {
    weekOffset,
    setWeekOffset,
    weekDates,
    datesInWeekSet,
    shiftIdsInWeek,
    assignmentsInWeek,
    constraintsInWeek,
    weeklyProgress,
  };
}
