import type { ConstraintStatus, ShiftType } from '@/lib/utils/enums';

export type ConstraintInput = {
  date: string;
  type: ShiftType;
  status: ConstraintStatus;
  note?: string;
};

export type ConstraintMode = 'single' | 'recurring' | 'range';

export type SystemMember = { id: string; full_name: string | null };
