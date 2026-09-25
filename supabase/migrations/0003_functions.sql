-- =============================================================================
-- Функции: нормализация кода, вход (студент/учитель), ПОСАДКА (атомарная, с выбором
-- места учеником), открытие открытки, чтение клумбы, админские инструменты.
-- =============================================================================

-- ---------- Помощники ----------------------------------------------------------

-- Приводит введённый код к каноническому виду: убирает пробелы и дефисы, делает заглавным
-- и заменяет кириллические двойники латиницей (те же пары, что в lib/codes.ts на клиенте).
-- Это спасает тех, кто вводит код с русской раскладки.
create or replace function public.normalize_code(p text)
returns text
language sql immutable
as $$
  select upper(translate(
    regexp_replace(coalesce(p, ''), '[[:space:]_.–—-]', '', 'g'),
    'АВЕКМНОРСТХУавекмноррстху',
    'ABEKMHOPCTXYabekmhopctxy'
  ));
$$;

-- Алфавит кодов: 20 знаков без похожих на другие буквы/цифры (см. lib/codes.ts).
-- Случайный код нужной длины, источник — криптографический (pgcrypto), без смещения:
-- 256 не делится на 20 нацело, поэтому байты ≥ 240 отбрасываются (rejection sampling).
create or replace function public._gen_code(p_len int default 10)
returns text
language plpgsql volatile
set search_path = public, extensions, pg_temp
as $$
declare
  alphabet constant text := 'ACDEFHJKMNPRTWXY3479';
  result text := '';
  b int;
begin
  while length(result) < p_len loop
    b := get_byte(gen_random_bytes(1), 0);
    if b < 240 then
      result := result || substr(alphabet, (b % 20) + 1, 1);
    end if;
  end loop;
  return result;
end $$;

-- Ключ клиента для защиты от перебора: IP из заголовка запроса (Supabase кладёт его в request.headers).
create or replace function public._client_key()
returns text
language sql stable
as $$
  select coalesce(
    nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
$$;

-- Больше 100 неудачных вводов за 10 минут с одного адреса → временная блокировка.
-- Порог большой, потому что целый класс может сидеть за одним школьным Wi-Fi.
create or replace function public._is_rate_limited(p_key text)
returns boolean
language sql stable
as $$
  select count(*) >= 100 from public.code_attempts
  where client_key = p_key and at > now() - interval '10 minutes';
$$;

create or replace function public._log_fail(p_key text)
returns void
language plpgsql
as $$
begin
  insert into public.code_attempts (client_key) values (p_key);
  if random() < 0.02 then
    delete from public.code_attempts where at < now() - interval '1 day';
  end if;
end $$;

revoke all on function public._gen_code(int), public._client_key(),
                       public._is_rate_limited(text), public._log_fail(text) from public;

-- ---------- Вход по коду ---------------------------------------------------------
-- Один код — либо ученик (одна посадка), либо учитель (личный кабинет с открыткой).
-- Ответ: {"ok": true, "role": "teacher", "teacher": {...}, "planted": n}
--     или {"ok": true, "role": "student", "status": "unused"}
--     или {"ok": true, "role": "student", "status": "used", "planting": {...} | null}
--     или {"ok": false, "error": "..."}
-- error: rate_limited | invalid_code | closed | not_open
-- Учителя пускает в любом статусе мероприятия — открытка не зависит от посадки цветов.
create or replace function public.login_code(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_key      text := public._client_key();
  v_code     text := public.normalize_code(p_code);
  v_event    text;
  v_pc       public.participation_codes%rowtype;
  v_teacher  public.teachers%rowtype;
  v_planting public.plantings%rowtype;
  v_planted  int;
begin
  if public._is_rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_code !~ '^[ACDEFHJKMNPRTWXY3479]{10}$' then
    perform public._log_fail(v_key);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_pc from public.participation_codes where code = v_code;
  if not found then
    perform public._log_fail(v_key);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_pc.role = 'teacher' then
    select * into v_teacher from public.teachers where id = v_pc.teacher_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_code');
    end if;
    select count(*) into v_planted from public.plantings where teacher_id = v_teacher.id;
    return jsonb_build_object(
      'ok', true, 'role', 'teacher', 'planted', v_planted,
      'teacher', jsonb_build_object(
        'id', v_teacher.id, 'first_name', v_teacher.first_name, 'middle_name', v_teacher.middle_name,
        'last_name', v_teacher.last_name, 'subject', v_teacher.subject, 'photo_url', v_teacher.photo_url
      )
    );
  end if;

  -- код ученика, уже использован — статус не зависит от того, идёт ли ещё посадка
  if v_pc.status = 'used' then
    select * into v_planting from public.plantings where id = v_pc.planting_id;
    return jsonb_build_object(
      'ok', true, 'role', 'student', 'status', 'used',
      'planting', case when found then jsonb_build_object(
        'id', v_planting.id, 'teacher_id', v_planting.teacher_id, 'flower_id', v_planting.flower_id,
        'color', v_planting.color, 'slot_id', v_planting.slot_id, 'x', v_planting.x, 'y', v_planting.y,
        'scale', v_planting.scale, 'rotation', v_planting.rotation, 'variant', v_planting.variant,
        'created_at', (extract(epoch from v_planting.created_at) * 1000)::bigint
      ) else null end
    );
  end if;

  select status into v_event from public.events where id = 1;
  if v_event is distinct from 'open' then
    return jsonb_build_object('ok', false, 'error', case when v_event = 'closed' then 'closed' else 'not_open' end);
  end if;

  return jsonb_build_object('ok', true, 'role', 'student', 'status', 'unused');
end $$;

-- ---------- ПОСАДКА ЦВЕТКА ------------------------------------------------------
-- Место на клумбе выбирает ученик (p_slot_id из lib/api → getApi().freeSlots()), цвет —
-- тоже ученик (p_color из палитры flower_colors); от учителя берутся только допустимые цветы.
-- Порядок нарочно такой:
--   1) все проверки, ничего не меняя;
--   2) захват ИМЕННО выбранного места (FOR UPDATE SKIP LOCKED — если его только что заняли,
--      строка либо заблокирована, либо уже taken, оба случая дают «место занято»);
--   3) атомарное «погашение» кода одним UPDATE ... WHERE status = 'unused'.
--      Если два запроса пришли с одним кодом, второй ждёт первого, видит status = 'used'
--      и получает 0 изменённых строк → «код уже использован»;
--   4) запись цветка и связь с кодом.
-- Любая непредвиденная ошибка на шагах 3–4 откатывает всё, включая погашение кода и занятость места.
-- Ответ: {"ok": true, "planting": {...}} или {"ok": false, "error": "..."}
-- error: closed | not_open | rate_limited | invalid_code | code_used | not_student_code
--        | invalid_choice | slot_taken
create or replace function public.plant_flower(
  p_code text, p_teacher_id bigint, p_flower_id bigint, p_color text, p_slot_id int
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_key      text := public._client_key();
  v_code     text := public.normalize_code(p_code);
  v_event    text;
  v_pc       public.participation_codes%rowtype;
  v_teacher  public.teachers%rowtype;
  v_color    text := upper(coalesce(p_color, ''));
  v_slot     public.garden_slots%rowtype;
  v_planting public.plantings%rowtype;
  v_code_id  bigint;
begin
  -- 1а. мероприятие открыто? (проверка на сервере, кнопку на сайте можно обойти)
  select status into v_event from public.events where id = 1;
  if v_event is distinct from 'open' then
    return jsonb_build_object('ok', false, 'error', case when v_event = 'closed' then 'closed' else 'not_open' end);
  end if;

  if public._is_rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_code !~ '^[ACDEFHJKMNPRTWXY3479]{10}$' then
    perform public._log_fail(v_key);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_pc from public.participation_codes where code = v_code;
  if not found then
    perform public._log_fail(v_key);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_pc.role <> 'student' then
    return jsonb_build_object('ok', false, 'error', 'not_student_code');
  end if;
  if v_pc.status <> 'unused' then
    return jsonb_build_object('ok', false, 'error', 'code_used');
  end if;

  -- 1б. учитель, цветок и цвет допустимы?
  select * into v_teacher from public.teachers where id = p_teacher_id and is_active;
  if not found or not exists (
    select 1
    from public.teacher_flowers tf
    join public.flowers f on f.id = tf.flower_id
    where tf.teacher_id = p_teacher_id and tf.flower_id = p_flower_id and f.is_active
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_choice');
  end if;
  if not exists (select 1 from public.flower_colors c where upper(c.hex) = v_color and c.is_active) then
    return jsonb_build_object('ok', false, 'error', 'invalid_choice');
  end if;

  -- 2. именно выбранное учеником место
  select * into v_slot
  from public.garden_slots
  where id = p_slot_id and not taken
  for update skip locked;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  -- 3. атомарно гасим код
  update public.participation_codes
     set status = 'used', used_at = now()
   where code = v_code and status = 'unused'
  returning id into v_code_id;

  if v_code_id is null then
    perform public._log_fail(v_key);
    return jsonb_build_object('ok', false, 'error', 'code_used');
  end if;

  -- 4. создаём цветок
  update public.garden_slots set taken = true where id = v_slot.id;

  insert into public.plantings (teacher_id, flower_id, slot_id, color, x, y, scale, rotation, variant)
  values (v_teacher.id, p_flower_id, v_slot.id, v_color, v_slot.x, v_slot.y, v_slot.scale, v_slot.rotation, v_slot.variant)
  returning * into v_planting;

  update public.participation_codes set planting_id = v_planting.id where id = v_code_id;

  return jsonb_build_object(
    'ok', true,
    'planting', jsonb_build_object(
      'id', v_planting.id,
      'teacher_id', v_planting.teacher_id,
      'flower_id', v_planting.flower_id,
      'color', v_planting.color,
      'slot_id', v_planting.slot_id,
      'x', v_planting.x,
      'y', v_planting.y,
      'scale', v_planting.scale,
      'rotation', v_planting.rotation,
      'variant', v_planting.variant,
      'created_at', (extract(epoch from v_planting.created_at) * 1000)::bigint
    )
  );
end $$;

-- ---------- Открытие открытки ---------------------------------------------------
-- Возвращает личное пожелание учителя ТОЛЬКО по его коду — это единственный путь, которым
-- текст покидает базу (teacher_cards не читается напрямую, см. 0002_security.sql).
-- Ответ: {"ok": true, "wish": "...", "planted": n} или {"ok": false, "error": "..."}
create or replace function public.open_card(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_key     text := public._client_key();
  v_code    text := public.normalize_code(p_code);
  v_pc      public.participation_codes%rowtype;
  v_wish    text;
  v_planted int;
begin
  if public._is_rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into v_pc from public.participation_codes where code = v_code and role = 'teacher';
  if not found then
    perform public._log_fail(v_key);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select wish into v_wish from public.teacher_cards where teacher_id = v_pc.teacher_id;
  select count(*) into v_planted from public.plantings where teacher_id = v_pc.teacher_id;

  return jsonb_build_object('ok', true, 'wish', coalesce(v_wish, ''), 'planted', v_planted);
end $$;

-- ---------- Свободные места (для выбора «посадить здесь») -----------------------
-- Как и в get_garden, отдаём одним jsonb: свободных мест обычно > 1000 (лимит PostgREST на select).
-- rows: [[id, x, y, scale, rotation, variant], ...]
create or replace function public.free_slots()
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
           jsonb_build_array(s.id, s.x, s.y, s.scale, s.rotation, s.variant) order by s.id
         ), '[]'::jsonb)
  from public.garden_slots s
  where not s.taken;
$$;

-- ---------- Чтение клумбы одним запросом ----------------------------------------
-- Обычный запрос к таблице отдаёт максимум 1000 строк (лимит PostgREST) — этого мало для 1500+ цветов.
-- Функция возвращает ОДНО значение jsonb, поэтому лимит строк не действует.
-- rows: [[id, teacher_id, flower_id, color, slot_id, x, y, scale, rotation, variant, created_at_ms], ...]
-- get_garden(0) — всё; get_garden(<последний известный id>) — только новое (догонка после обрыва связи).
-- Учителей, цветы и палитру цветов (маленькие таблицы) читайте обычным select — лимит их не касается.
create or replace function public.get_garden(p_after bigint default 0)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.plantings),
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_array(p.id, p.teacher_id, p.flower_id, p.color, p.slot_id, p.x, p.y, p.scale, p.rotation, p.variant,
                          (extract(epoch from p.created_at) * 1000)::bigint)
        order by p.id)
      from public.plantings p
      where p.id > coalesce(p_after, 0)
    ), '[]'::jsonb)
  );
$$;

-- ---------- Права на вызов ------------------------------------------------------
revoke all on function public.login_code(text), public.plant_flower(text, bigint, bigint, text, int),
                       public.open_card(text), public.free_slots(), public.get_garden(bigint) from public;
grant execute on function public.login_code(text)                              to anon, authenticated;
grant execute on function public.plant_flower(text, bigint, bigint, text, int) to anon, authenticated;
grant execute on function public.open_card(text)                               to anon, authenticated;
grant execute on function public.free_slots()                                  to anon, authenticated;
grant execute on function public.get_garden(bigint)                            to anon, authenticated;

-- =============================================================================
-- Админские функции (внутри проверяется is_admin(), обычному пользователю они откажут)
-- =============================================================================

-- Сгенерировать коды.
-- p_role = 'student' — коды на посадку, их общее число ограничено числом мест на клумбе.
-- p_role = 'teacher' — личные коды для входа учителя с id = p_teacher_id (обычно один код на учителя;
--   чтобы переиздать код, удалите старый в админке и сгенерируйте новый).
create or replace function public.admin_generate_codes(
  p_count int, p_label text default null, p_role text default 'student', p_teacher_id bigint default null
)
returns int
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_added int := 0;
  v_batch int;
  v_slots int;
  v_existing int;
  v_tries int := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 5000 then
    raise exception 'Количество кодов должно быть от 1 до 5000';
  end if;
  if p_role not in ('student', 'teacher') then
    raise exception 'Роль кода должна быть student или teacher';
  end if;
  if p_role = 'teacher' and p_teacher_id is null then
    raise exception 'Для кода учителя укажите teacher_id';
  end if;

  if p_role = 'student' then
    select count(*) into v_slots    from public.garden_slots;
    select count(*) into v_existing from public.participation_codes where role = 'student';
    if v_existing + p_count > v_slots then
      raise exception 'На клумбе всего % мест, уже создано % кодов учеников, нельзя добавить ещё %', v_slots, v_existing, p_count;
    end if;
  end if;

  while v_added < p_count and v_tries < 20 loop
    v_tries := v_tries + 1;
    insert into public.participation_codes (code, label, role, teacher_id)
    select public._gen_code(10), nullif(btrim(p_label), ''), p_role,
           case when p_role = 'teacher' then p_teacher_id end
    from generate_series(1, p_count - v_added)
    on conflict (code) do nothing;
    get diagnostics v_batch = row_count;
    v_added := v_added + v_batch;
  end loop;

  return v_added;
end $$;

-- CSV с кодами: code,role,teacher,status,used_at,label. Время — в часовом поясе p_tz (по умолчанию Москва).
create or replace function public.admin_export_codes(p_only_unused boolean default false, p_tz text default 'Europe/Moscow')
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_csv text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select 'code,role,teacher,status,used_at,label' || E'\n' || coalesce(string_agg(
           c.code || ',' || c.role || ',' ||
           coalesce('"' || replace(t.last_name || ' ' || t.first_name, '"', '""') || '"', '') || ',' ||
           upper(c.status) || ',' ||
           coalesce(to_char(c.used_at at time zone p_tz, 'YYYY-MM-DD"T"HH24:MI:SS'), '') || ',' ||
           coalesce('"' || replace(c.label, '"', '""') || '"', ''),
           E'\n' order by c.id), '')
    into v_csv
    from public.participation_codes c
    left join public.teachers t on t.id = c.teacher_id
   where (not p_only_unused) or c.status = 'unused';

  return v_csv;
end $$;

-- График посадок: сколько цветов посажено в каждом интервале.
create or replace function public.admin_timeline(p_minutes int default 15)
returns table (bucket timestamptz, n bigint)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select date_bin(make_interval(mins => greatest(p_minutes, 1)), p.created_at, timestamptz '2000-01-01 00:00:00+00') as b,
           count(*)::bigint
      from public.plantings p
     group by 1
     order by 1;
end $$;

-- Цифры для Dashboard одним запросом.
create or replace function public.admin_stats()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'plantings',         (select count(*) from public.plantings),
    'codes_students_total',  (select count(*) from public.participation_codes where role = 'student'),
    'codes_students_used',   (select count(*) from public.participation_codes where role = 'student' and status = 'used'),
    'codes_students_unused', (select count(*) from public.participation_codes where role = 'student' and status = 'unused'),
    'codes_teachers_total',  (select count(*) from public.participation_codes where role = 'teacher'),
    'slots_total',        (select count(*) from public.garden_slots),
    'slots_free',         (select count(*) from public.garden_slots where not taken),
    'teachers_without_wish', (select count(*) from public.teachers t
                               where t.is_active and not exists (
                                 select 1 from public.teacher_cards c where c.teacher_id = t.id and length(btrim(c.wish)) > 0
                               )),
    'by_teacher',         coalesce((select jsonb_object_agg(teacher_id, n)
                              from (select teacher_id, count(*) as n from public.plantings group by teacher_id) t), '{}'::jsonb)
  );
end $$;

revoke all on function public.admin_generate_codes(int, text, text, bigint), public.admin_export_codes(boolean, text),
                       public.admin_timeline(int), public.admin_stats() from public;
grant execute on function public.admin_generate_codes(int, text, text, bigint) to authenticated;
grant execute on function public.admin_export_codes(boolean, text)             to authenticated;
grant execute on function public.admin_timeline(int)                           to authenticated;
grant execute on function public.admin_stats()                                 to authenticated;
