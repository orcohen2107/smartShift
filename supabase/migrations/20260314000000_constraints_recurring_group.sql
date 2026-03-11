-- קבוצת מחזור – אילוצים שנוצרו יחד כ"מחזורי" חולקים אותו recurring_group_id
alter table public.constraints
  add column if not exists recurring_group_id uuid;

create index if not exists idx_constraints_recurring_group_id
  on public.constraints(recurring_group_id)
  where recurring_group_id is not null;

comment on column public.constraints.recurring_group_id is 'אילוצים באותה קבוצה נוצרו כמחזור אחד (למחיקת כל המחזור)';
