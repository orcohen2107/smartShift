-- מילואים: סימון בהרשמה, ברירת מחדל לא (כל המשתמשים הקיימים יישארו false)
alter table public.profiles
  add column if not exists is_reserves boolean not null default false;

alter table public.workers
  add column if not exists is_reserves boolean not null default false;

comment on column public.profiles.is_reserves is 'סומן בהרשמה: האם המשתמש במילואים';
comment on column public.workers.is_reserves is 'סומן בהרשמה / בעת יצירת worker: האם במילואים';
