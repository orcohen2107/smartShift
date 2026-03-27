export enum Role {
  Manager = 'manager',
  Commander = 'commander',
  Worker = 'worker',
  Guest = 'guest',
}

export function canManage(role: Role): boolean {
  return role === Role.Manager || role === Role.Commander;
}
