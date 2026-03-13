export enum Role {
  Manager = 'manager',
  Commander = 'commander',
  Worker = 'worker',
  Guest = 'guest',
}

/** מנהל או מפקד – שניהם יכולים לנהל */
export function canManage(role: Role): boolean {
  return role === Role.Manager || role === Role.Commander;
}
