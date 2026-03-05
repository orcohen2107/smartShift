import { Role } from "../enums/role";
import { ShiftType } from "../enums/shiftType";
import { ConstraintStatus } from "../enums/constraintStatus";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface Shift {
  id: string;
  date: string; // yyyy-mm-dd
  type: ShiftType;
  required_count: number;
  created_by: string;
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
  workers: Profile[];
  constraints: Constraint[];
}

