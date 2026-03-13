-- הוספת תפקידי commander ו-guest – מפקד מקבל הרשאות ניהול כמו מנהל
-- עדכון כל מדיניות RLS: p.role = 'manager' -> p.role in ('manager', 'commander')

-- Workers
drop policy if exists "Workers: manager can insert" on public.workers;
create policy "Workers: manager or commander can insert"
  on public.workers for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('manager', 'commander')
    )
  );

drop policy if exists "Workers: manager can update" on public.workers;
create policy "Workers: manager or commander can update"
  on public.workers for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('manager', 'commander')
    )
  );

-- Assignments
drop policy if exists "Assignments: manager can insert" on public.assignments;
create policy "Assignments: manager or commander can insert"
  on public.assignments for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('manager', 'commander')
    )
  );

drop policy if exists "Assignments: manager can delete" on public.assignments;
create policy "Assignments: manager or commander can delete"
  on public.assignments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('manager', 'commander')
    )
  );

-- Shift boards
drop policy if exists "Shift boards: manager can modify" on public.shift_boards;
create policy "Shift boards: manager or commander can modify"
  on public.shift_boards for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('manager', 'commander')
    )
  );

-- Systems
drop policy if exists "Systems: manager can insert" on public.systems;
create policy "Systems: manager or commander can insert"
  on public.systems for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('manager', 'commander')
    )
  );

