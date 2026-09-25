-- =============================================================================
-- «Клумба для учителей» — схема базы данных
-- Как применять: Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- Порядок: 0001 → 0002 → 0003 → 0004. Файлы можно запускать повторно только на пустой базе.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Мероприятие (ровно одна строка) ----------------------------------
create table public.events (
  id            smallint primary key default 1 check (id = 1),
  title         text        not null default 'С Днём учителя!',
  slogan        text        not null default '',
  -- draft  — посадка ещё не началась, open — идёт, closed — завершена (окончательно проверяется на сервере)
  status        text        not null default 'draft' check (status in ('draft', 'open', 'closed')),
  starts_at     timestamptz,          -- только для показа посетителям, посадку не блокирует
  ends_at       timestamptz,          -- только для показа посетителям, посадку не блокирует
  closed_title  text        not null default 'Наша клумба готова!',
  closed_text   text        not null default 'Спасибо всем, кто посадил свой цветок для наших учителей.',
  show_photos   boolean     not null default true,
  show_video    boolean     not null default true,
  show_stats    boolean     not null default true,
  animations    boolean     not null default true,
  sound         boolean     not null default false,
  closed_at     timestamptz,
  updated_at    timestamptz not null default now()
);

-- ---------- Поздравление (одна строка) ---------------------------------------
create table public.greeting (
  id         smallint primary key default 1 check (id = 1),
  title      text not null,
  body       text not null,
  signature  text not null default '',
  extra      text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- Учителя -----------------------------------------------------------
create table public.teachers (
  id          bigint generated always as identity primary key,
  first_name  text    not null,
  middle_name text    not null default '',
  last_name   text    not null default '',
  subject     text    not null,
  description text    not null default '',
  photo_url   text,
  -- акцентный цвет учителя: точка в легенде клумбы и в списке учителей. На цвет цветка НЕ влияет —
  -- цвет цветка выбирает ученик из public.flower_colors.
  color       text    not null default '#E03131' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order  int     not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Виды цветов -------------------------------------------------------
-- builtin_kind — цветок, нарисованный в коде (tulip, rose, ...);
-- image_url    — свой цветок, загруженный в Storage (SVG/PNG/WebP).
create table public.flowers (
  id           bigint generated always as identity primary key,
  name         text not null,
  builtin_kind text check (builtin_kind in ('tulip', 'rose', 'poppy', 'daisy', 'cornflower', 'sunflower')),
  image_url    text,
  image_type   text check (image_type in ('svg', 'png', 'webp')),
  sort_order   int     not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint flowers_has_picture check (builtin_kind is not null or image_url is not null)
);

-- какие цветы можно выбрать для какого учителя
create table public.teacher_flowers (
  teacher_id bigint not null references public.teachers (id) on delete cascade,
  flower_id  bigint not null references public.flowers (id)  on delete cascade,
  primary key (teacher_id, flower_id)
);
create index teacher_flowers_flower_idx on public.teacher_flowers (flower_id);

-- ---------- Цвета цветов -------------------------------------------------------
-- Палитра, из которой ученик выбирает цвет своего цветка (шаг «выберите цвет» на сайте).
-- Совпадает по смыслу с lib/garden/palette.ts — если меняете одно, меняйте и другое.
create table public.flower_colors (
  id         bigint generated always as identity primary key,
  name       text not null,
  hex        text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int     not null default 0,
  is_active  boolean not null default true
);

-- ---------- Открытки учителям --------------------------------------------------
-- Личное пожелание, которое учитель видит после входа по своему коду и нажатия «Открыть открытку».
-- Одна строка на учителя. Пока wish пустой, сайт показывает запасной текст (см. lib/postcard.ts).
create table public.teacher_cards (
  teacher_id bigint primary key references public.teachers (id) on delete cascade,
  wish       text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- Места на клумбе ---------------------------------------------------
-- Заранее сгенерированные точки (см. 0004_seed.sql). Ученик выбирает свободное место сам —
-- поэтому оно должно быть заранее известно и захватываться атомарно (см. plant_flower).
create table public.garden_slots (
  id       int primary key,
  x        real not null check (x between 0 and 1),
  y        real not null check (y between 0 and 1),
  scale    real not null,
  rotation real not null,
  variant  smallint not null check (variant between 0 and 7),
  taken    boolean not null default false
);
create index garden_slots_free_idx on public.garden_slots (id) where not taken;

-- ---------- Посадки -----------------------------------------------------------
-- Здесь нет ссылки на код: посетители читают эту таблицу, а связь «код ↔ цветок» им видеть не нужно.
create table public.plantings (
  id         bigint generated always as identity primary key,
  teacher_id bigint   not null references public.teachers (id) on delete restrict,
  flower_id  bigint   not null references public.flowers (id)  on delete restrict,
  slot_id    int      not null unique references public.garden_slots (id),
  color      text     not null check (color ~ '^#[0-9A-Fa-f]{6}$'),  -- цвет, который выбрал ученик
  x          real     not null,
  y          real     not null,
  scale      real     not null,
  rotation   real     not null,
  variant    smallint not null,
  created_at timestamptz not null default now()
);
create index plantings_created_idx on public.plantings (created_at);
create index plantings_teacher_idx on public.plantings (teacher_id);

-- ---------- Персональные коды --------------------------------------------------
-- Алфавит без похожих символов: нет 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B, U/V и т. д. — 20 знаков × 10 позиций.
-- role = 'student' — код на один цветок (один код — одна посадка, см. plant_flower).
-- role = 'teacher' — личный код учителя для входа и открытия открытки; не «расходуется» при входе.
-- Входа администратора здесь нет: в демо-предпросмотре (lib/api/demo.ts) он сделан отдельным
-- словом-кодом для удобства показа, но в настоящей базе админ входит через Supabase Auth
-- (email + пароль) — см. is_admin()/public.admins в 0002_security.sql. Смешивать эти два
-- механизма не стоит: слово в клиентском коде видно любому, кто откроет исходники страницы.
create table public.participation_codes (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[ACDEFHJKMNPRTWXY3479]{10}$'),
  role        text not null default 'student' check (role in ('student', 'teacher')),
  teacher_id  bigint references public.teachers (id) on delete cascade,
  status      text not null default 'unused' check (status in ('unused', 'used')),
  label       text,                    -- например, класс: «9А»
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  planting_id bigint unique references public.plantings (id) on delete set null,
  constraint participation_codes_role_teacher check (
    (role = 'student' and teacher_id is null) or (role = 'teacher' and teacher_id is not null)
  )
);
create index participation_codes_status_idx  on public.participation_codes (status);
create index participation_codes_teacher_idx on public.participation_codes (teacher_id) where role = 'teacher';

-- ---------- Медиа (фото и видео) ---------------------------------------------
create table public.media (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  url          text not null,
  title        text not null default '',
  description  text not null default '',
  mime_type    text,
  size_bytes   bigint,
  sort_order   int     not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------- Администраторы ----------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Неудачные попытки ввода кода (защита от перебора) -----------------
create table public.code_attempts (
  id         bigint generated always as identity primary key,
  client_key text        not null,
  at         timestamptz not null default now()
);
create index code_attempts_key_idx on public.code_attempts (client_key, at);

-- ---------- Служебные триггеры ------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger events_touch       before update on public.events       for each row execute function public.touch_updated_at();
create trigger greeting_touch     before update on public.greeting     for each row execute function public.touch_updated_at();
create trigger teacher_cards_touch before update on public.teacher_cards for each row execute function public.touch_updated_at();

-- при завершении посадки запоминаем время
create or replace function public.events_track_close()
returns trigger language plpgsql as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end $$;

create trigger events_close_time before update on public.events for each row execute function public.events_track_close();
