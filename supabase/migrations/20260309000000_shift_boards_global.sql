-- לוחות שיבוצים משותפים לכל המערכות – הסרת system_id
alter table public.shift_boards drop column if exists system_id;
drop index if exists idx_shift_boards_system_id;
