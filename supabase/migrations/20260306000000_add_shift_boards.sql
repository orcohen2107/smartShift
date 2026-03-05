-- לוחות שיבוצים (שגרה, מלחמה וכו')
create table if not exists public.shift_boards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  workers_per_shift integer not null default 1 check (workers_per_shift >= 1),
  single_person_for_day boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shift_boards_created_by on public.shift_boards(created_by);

-- הוספת board_id ו-required_count ל-shifts
alter table public.shifts
  add column if not exists board_id uuid references public.shift_boards(id) on delete cascade;

alter table public.shifts
  add column if not exists required_count integer not null default 1 check (required_count >= 1);

-- סוג משמרת full_day (אדם יחיד לכל היום)
alter table public.shifts drop constraint if exists shifts_type_check;
alter table public.shifts
  add constraint shifts_type_check check (type in ('day', 'night', 'full_day'));

-- RLS ל-shift_boards
alter table public.shift_boards enable row level security;

create policy "Shift boards: read for authenticated"
  on public.shift_boards for select
  using (auth.role() = 'authenticated');

create policy "Shift boards: manager can modify"
  on public.shift_boards for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );

-- לוח ברירת מחדל
insert into public.shift_boards (id, name, workers_per_shift, single_person_for_day)
select uuid_generate_v4(), 'שגרה', 1, false
where not exists (select 1 from public.shift_boards limit 1);

-- קישור משמרות קיימות ללוח ברירת מחדל
update public.shifts
set board_id = (select id from public.shift_boards limit 1)
where board_id is null;
