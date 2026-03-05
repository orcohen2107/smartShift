-- RLS ל-assignments – קריאה למחוברים, שינוי למנהלים בלבד
alter table public.assignments enable row level security;

-- קריאה: כל משתמש מחובר
drop policy if exists "Assignments: read for authenticated" on public.assignments;
create policy "Assignments: read for authenticated"
  on public.assignments for select
  using (auth.role() = 'authenticated');

-- הוספה: מנהל בלבד
drop policy if exists "Assignments: manager can insert" on public.assignments;
create policy "Assignments: manager can insert"
  on public.assignments for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );

-- מחיקה: מנהל בלבד
drop policy if exists "Assignments: manager can delete" on public.assignments;
create policy "Assignments: manager can delete"
  on public.assignments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );
