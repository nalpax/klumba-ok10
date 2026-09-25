-- =============================================================================
-- Права доступа: Row Level Security, гранты, Storage, Realtime.
-- Идея: посетитель (роль anon) может ТОЛЬКО читать публичные данные и вызывать
-- функции check_code / plant_flower / get_garden. Писать в таблицы напрямую он не может.
-- Администратор (Supabase Auth + запись в public.admins) управляет всем через RLS.
-- =============================================================================

-- ---------- Кто администратор -------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Включаем RLS везде ------------------------------------------------
alter table public.events              enable row level security;
alter table public.greeting            enable row level security;
alter table public.teachers            enable row level security;
alter table public.flowers             enable row level security;
alter table public.teacher_flowers     enable row level security;
alter table public.flower_colors       enable row level security;
alter table public.teacher_cards       enable row level security;
alter table public.garden_slots        enable row level security;
alter table public.plantings           enable row level security;
alter table public.participation_codes enable row level security;
alter table public.media               enable row level security;
alter table public.admins              enable row level security;
alter table public.code_attempts       enable row level security;  -- без политик: доступ только из функций

-- ---------- Гранты: сначала отбираем всё, потом выдаём нужное ------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.events, public.greeting, public.teachers, public.flowers,
                public.teacher_flowers, public.flower_colors, public.plantings, public.media to anon, authenticated;

grant update on public.events, public.greeting to authenticated;
grant insert, update, delete on public.teachers, public.flowers, public.teacher_flowers,
                                  public.flower_colors, public.teacher_cards, public.media to authenticated;
grant select, insert, update, delete on public.participation_codes to authenticated;
-- wish-текст открытки не читается напрямую (только через функцию open_card), но админу нужно его редактировать
grant select on public.teacher_cards to authenticated;
grant select on public.garden_slots to authenticated;
grant select on public.admins to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- Политики: чтение для всех ------------------------------------------
create policy events_read   on public.events   for select using (true);
create policy greeting_read on public.greeting for select using (true);

-- Учитель виден, пока он активен, либо если за него уже кто-то посадил цветок
-- (иначе подсказки и статистика на готовой клумбе потеряли бы предмет).
create policy teachers_read on public.teachers for select
  using (is_active or exists (select 1 from public.plantings p where p.teacher_id = teachers.id));

-- Тип цветка читается всегда: по нему рисуются уже посаженные цветы.
-- «Неактивный» цветок только пропадает из выбора (это проверяет plant_flower).
create policy flowers_read          on public.flowers          for select using (true);
create policy teacher_flowers_read  on public.teacher_flowers  for select using (true);

-- Палитра цветов, из которой ученик выбирает цвет — читается всеми, показываются только активные.
create policy flower_colors_read on public.flower_colors for select using (is_active or public.is_admin());

-- Все посадки публичны: по ним рисуется клумба и считается статистика.
create policy plantings_read on public.plantings for select using (true);

-- teacher_cards НЕ читается напрямую посетителями (даже под RLS) — текст пожелания отдаёт только
-- функция open_card (security definer), которая проверяет код учителя. Прямое чтение — только админ.

create policy media_read on public.media for select using (is_active or public.is_admin());

-- ---------- Политики: запись только для администратора -------------------------
create policy events_admin_update   on public.events   for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy greeting_admin_update on public.greeting for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy teachers_admin         on public.teachers         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy flowers_admin          on public.flowers          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy teacher_flowers_admin  on public.teacher_flowers  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy flower_colors_admin    on public.flower_colors    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy teacher_cards_admin    on public.teacher_cards    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy media_admin            on public.media            for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy codes_admin            on public.participation_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy slots_admin_read       on public.garden_slots     for select to authenticated using (public.is_admin());

-- каждый может увидеть только свою строку (так приложение узнаёт, админ ли пользователь)
create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

-- Посадки создаёт ТОЛЬКО функция plant_flower (security definer): политик на insert/update/delete нет.

-- ---------- Realtime: новые цветы и смена статуса мероприятия ------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plantings') then
    alter publication supabase_realtime add table public.plantings;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

-- ---------- Storage: бакеты, лимиты, типы файлов --------------------------------
-- Лимиты подобраны под бесплатный план Supabase (1 ГБ хранилища, ограничение на размер файла).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('teachers', 'teachers', true,   2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('flowers',  'flowers',  true,   1 * 1024 * 1024, array['image/svg+xml', 'image/png', 'image/webp']),
  ('gallery',  'gallery',  true,   5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('video',    'video',    true,  50 * 1024 * 1024, array['video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy site_files_read on storage.objects for select
  using (bucket_id in ('teachers', 'flowers', 'gallery', 'video'));

create policy site_files_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('teachers', 'flowers', 'gallery', 'video') and public.is_admin());

create policy site_files_update on storage.objects for update to authenticated
  using (bucket_id in ('teachers', 'flowers', 'gallery', 'video') and public.is_admin())
  with check (bucket_id in ('teachers', 'flowers', 'gallery', 'video') and public.is_admin());

create policy site_files_delete on storage.objects for delete to authenticated
  using (bucket_id in ('teachers', 'flowers', 'gallery', 'video') and public.is_admin());
