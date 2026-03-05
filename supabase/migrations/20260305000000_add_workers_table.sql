-- טבלת workers: רשימת אנשים לשיבוץ (יכולים להיות בלי משתמש במערכת)
create table if not exists public.workers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workers_user_id on public.workers(user_id);

-- מילוי מעובדים קיימים (profiles עם role=worker) – כל אחד הופך ל-worker עם אותו id
insert into public.workers (id, full_name, email, user_id)
select id, full_name, email, id
from public.profiles
where role = 'worker'
on conflict (id) do nothing;

-- עדכון FK ב-assignments: מ-profiles ל-workers
-- אם השגיאה תהיה על שם ה-constraint, הרץ ב-SQL Editor: SELECT conname FROM pg_constraint WHERE conrelid = 'public.assignments'::regclass AND contype = 'f';
alter table public.assignments
  drop constraint if exists assignments_worker_id_fkey;

alter table public.assignments
  add constraint assignments_worker_id_fkey
  foreign key (worker_id) references public.workers(id) on delete cascade;

-- RLS
alter table public.workers enable row level security;

create policy "Workers: read for authenticated"
  on public.workers for select
  using (auth.role() = 'authenticated');

create policy "Workers: manager can insert"
  on public.workers for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );

create policy "Workers: manager can update"
  on public.workers for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );

-- עובד יכול לעדכן שורת worker שלא מקושרת (user_id null) כדי לקשר אליו בהרשמה
create policy "Workers: claim self when user_id is null"
  on public.workers for update
  using (user_id is null)
  with check (user_id = auth.uid());
