-- משתמש יכול להוסיף שורת worker לעצמו (בעת ensure אחרי התחברות) – כדי שלא תהיה תלות ב-service_role
create policy "Workers: user can insert own row"
  on public.workers for insert
  with check (id = auth.uid() and user_id = auth.uid());
