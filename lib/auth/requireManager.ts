import { requireUser } from './requireUser';
import { Role } from '../utils/enums/role';

export async function requireManager(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) return res;

  if (res.profile.role !== Role.Manager) {
    return {
      ok: false as const,
      status: 403,
      error: 'Only managers can access this resource',
    };
  }

  return res;
}
