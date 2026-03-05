import { Role } from "../enums/role";
import { ShiftType } from "../enums/shiftType";
import { ConstraintStatus } from "../enums/constraintStatus";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
}

/** כונן לשיבוץ – יכול להיות ללא משתמש (נוסף ידנית על ידי מנהל) */
export interface Worker {
  id: string;
  full_name: string | null;
  email: string | null;
  user_id: string | null;
  created_at: string;
}

export interface Shift {
  id: string;
  date: string; // yyyy-mm-dd
  type: ShiftType;
  created_by: string;
  board_id: string | null;
  required_count: number;
}

export interface ShiftBoard {
  id: string;
  name: string;
  workers_per_shift: number;
  single_person_for_day: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Constraint {
  id: string;
  worker_id: string;
  date: string;
  type: ShiftType;
  status: ConstraintStatus;
  note: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  shift_id: string;
  worker_id: string;
  created_at: string;
}

export interface AssignmentsOverview {
  shifts: Shift[];
  assignments: Assignment[];
  workers: Worker[];
  constraints: Constraint[];
  boards: ShiftBoard[];
}

