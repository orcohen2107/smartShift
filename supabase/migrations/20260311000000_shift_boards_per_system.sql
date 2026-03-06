-- לוחות שיבוצים לפי מערכת – כל מנהל רואה רק לוחות של המערכת שלו
alter table public.shift_boards
  add column if not exists system_id uuid references public.systems(id) on delete restrict;

-- לוחות קיימים: שיוך למערכת הראשונה (או null אם אין מערכות)
update public.shift_boards
set system_id = (select id from public.systems limit 1)
where system_id is null;

create index if not exists idx_shift_boards_system_id on public.shift_boards(system_id);
