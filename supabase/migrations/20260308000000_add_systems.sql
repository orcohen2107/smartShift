-- טבלת מערכות – כל משתמש משתייך למערכת אחת
create table if not exists public.systems (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- מערכת ברירת מחדל: ראשית הצירים
insert into public.systems (id, name)
select uuid_generate_v4(), 'ראשית הצירים'
where not exists (select 1 from public.systems limit 1);

-- הוספת system_id ל-profiles
alter table public.profiles
  add column if not exists system_id uuid references public.systems(id) on delete restrict;

-- קישור פרופילים קיימים למערכת ראשית
update public.profiles
set system_id = (select id from public.systems limit 1)
where system_id is null;

-- הוספת system_id ל-workers
alter table public.workers
  add column if not exists system_id uuid references public.systems(id) on delete restrict;

-- קישור workers קיימים למערכת ראשית
update public.workers
set system_id = (select id from public.systems limit 1)
where system_id is null;

-- אינדקסים
create index if not exists idx_profiles_system_id on public.profiles(system_id);
create index if not exists idx_workers_system_id on public.workers(system_id);

-- RLS ל-systems
alter table public.systems enable row level security;

-- קריאה: כל אחד (גם לא מחובר – לצורך הרשמה)
create policy "Systems: public read"
  on public.systems for select
  using (true);

-- הוספה: מנהל בלבד
create policy "Systems: manager can insert"
  on public.systems for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );
