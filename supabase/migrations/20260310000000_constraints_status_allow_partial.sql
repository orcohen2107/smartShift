-- הרחבת ה-check של status באילוצים – לאפשר גם 'partial' (פנוי לכמה שעות)
alter table public.constraints
  drop constraint if exists constraints_status_check;

alter table public.constraints
  add constraint constraints_status_check
  check (status in ('unavailable', 'partial'));
