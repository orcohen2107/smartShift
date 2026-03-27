import type { Assignment, Shift, Worker } from '@/lib/utils/interfaces';
import type { ShiftType } from '@/lib/utils/enums';

export type CreateShiftInput = {
  date: string;
  type: ShiftType;
  required_count?: number;
};

export type AssigningCell = {
  date: string;
  type: ShiftType;
  shiftId: string | null;
};

export type PendingConstraintConfirm = {
  shiftId: string;
  workerId: string;
  workerName: string;
};

export type AutofillProposalItem = {
  date: string;
  type: string;
  worker_id: string;
  worker_name: string;
};

export type EditingProposal = {
  date: string;
  type: string;
  worker_id: string;
};

export type ReplacementEdit = {
  date: string;
  type: string;
  from_worker_id: string;
  to_worker_id: string;
  to_worker_name: string;
};

export type ShiftDrawerState = {
  date: string;
  cellType: ShiftType;
  shift: Shift | null;
  assigns: Assignment[];
};

export type AutofillPreviewBody = {
  board_id: string;
  from_date: string;
  to_date: string;
};

export type ApplyAssignment = {
  date: string;
  type: string;
  worker_id: string;
};

export type AutofillApplyBody = {
  board_id: string;
  from_date: string;
  to_date: string;
  additions?: ApplyAssignment[];
  removals?: ApplyAssignment[];
  /** @deprecated use additions */
  assignments?: ApplyAssignment[];
};
