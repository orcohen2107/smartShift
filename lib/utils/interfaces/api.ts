import type { ConstraintStatus, ShiftType } from "../enums";

/** Request body for POST /api/auth/signup */
export interface SignupBody {
  email: string;
  password: string;
  full_name?: string;
  system_id?: string;
  /** מילואים – ברירת מחדל false */
  is_reserves?: boolean;
}

/** Request body for POST /api/systems */
export interface SystemPostBody {
  name: string;
}

/** Request body for POST /api/constraints */
export interface ConstraintPostBody {
  date: string;
  type: ShiftType;
  status?: ConstraintStatus;
  note?: string;
}

/** Request body for PATCH /api/constraints/[id] */
export interface ConstraintPatchBody {
  date?: string;
  type?: ShiftType;
  status?: ConstraintStatus;
  note?: string | null;
}

/** Request body for POST /api/shifts */
export interface ShiftPostBody {
  date: string;
  type: ShiftType;
  board_id?: string;
  required_count?: number;
}

/** Request body for POST /api/boards */
export interface BoardPostBody {
  name: string;
  workers_per_shift?: number;
  single_person_for_day?: boolean;
}

/** Request body for PATCH /api/shifts/[id] */
export interface ShiftPatchBody {
  date?: string;
  type?: ShiftType;
}

/** Request body for POST /api/assignments */
export interface AssignmentPostBody {
  shift_id: string;
  worker_id: string;
}

/** Request body for DELETE /api/assignments */
export interface AssignmentDeleteBody {
  assignment_id: string;
}

/** Request body for POST /api/workers (manager adds person to list) */
export interface WorkerPostBody {
  full_name: string;
}

/** Next.js dynamic route params for [id] routes */
export interface RouteParamsId {
  params: { id: string };
}
