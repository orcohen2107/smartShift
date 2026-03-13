import { requireUser } from './requireUser';
import { canManage } from '../utils/enums/role';

export async function requireManager(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) return res;

  if (!canManage(res.profile.role)) {
    return {
      ok: false as const,
      status: 403,
      error: 'Only managers or commanders can access this resource',
    };
  }

  return res;
}
