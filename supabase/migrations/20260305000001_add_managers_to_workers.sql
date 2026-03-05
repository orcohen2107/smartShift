-- הוספת מנהלים לרשימת workers כדי שיוכלו להיות משובצים למשמרות
insert into public.workers (id, full_name, email, user_id)
select id, full_name, email, id
from public.profiles
where role = 'manager'
on conflict (id) do nothing;
