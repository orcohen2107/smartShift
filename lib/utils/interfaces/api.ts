import type { ConstraintStatus, ShiftType } from "../enums";

/** Request body for POST /api/auth/signup */
export interface SignupBody {
  email: string;
  password: string;
  full_name?: string;
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
  required_count: number;
}

/** Request body for PATCH /api/shifts/[id] */
export interface ShiftPatchBody {
  date?: string;
  type?: ShiftType;
  required_count?: number;
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

/** Next.js dynamic route params for [id] routes */
export interface RouteParamsId {
  params: { id: string };
}
