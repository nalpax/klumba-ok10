-- =============================================================================
-- Начальные данные: мероприятие, поздравление, встроенные цветы, места на клумбе.
-- =============================================================================

insert into public.events (id) values (1) on conflict (id) do nothing;

insert into public.greeting (id, title, body, signature, extra) values (
  1,
  'Дорогие учителя!',
  E'Спасибо вам за знания, терпение, поддержку и вдохновение. Каждый день вы помогаете нам становиться лучше, открывать новое и верить в свои силы.\n\n'
  'В этот день мы хотим сказать вам большое спасибо за ваш труд, заботу и время, которое вы дарите нам.',
  'С Днём учителя! 🌷',
  E'Ученики Образовательного комплекса №\u00A010'
) on conflict (id) do nothing;

-- Встроенные цветы (рисуются кодом, картинки не нужны). Порядок и включение меняются в админке.
insert into public.flowers (name, builtin_kind, sort_order)
select v.name, v.kind, v.ord
from (values
  ('Тюльпан',   'tulip',      1),
  ('Роза',      'rose',       2),
  ('Мак',       'poppy',      3),
  ('Ромашка',   'daisy',      4),
  ('Василёк',   'cornflower', 5),
  ('Подсолнух', 'sunflower',  6)
) as v(name, kind, ord)
where not exists (select 1 from public.flowers f where f.builtin_kind = v.kind);

-- Палитра цветов, из которой ученик выбирает цвет своего цветка (совпадает с lib/garden/palette.ts).
insert into public.flower_colors (name, hex, sort_order)
select v.name, v.hex, v.ord
from (values
  ('Красный',      '#E03131', 1),
  ('Малиновый',    '#C2255C', 2),
  ('Розовый',      '#F783AC', 3),
  ('Персиковый',   '#FFA574', 4),
  ('Оранжевый',    '#F08C00', 5),
  ('Жёлтый',       '#F5C518', 6),
  ('Салатовый',    '#A9E34B', 7),
  ('Бирюзовый',    '#15AABF', 8),
  ('Голубой',      '#6CB4F5', 9),
  ('Синий',        '#2F6FDE', 10),
  ('Фиолетовый',   '#7950F2', 11),
  ('Сиреневый',    '#B197FC', 12),
  ('Белый',        '#F8F4E8', 13),
  ('Бордовый',     '#8C2F4B', 14)
) as v(name, hex, ord)
where not exists (select 1 from public.flower_colors c where c.hex = v.hex);

-- ---------- Места на клумбе -----------------------------------------------------
-- Размер мира 2000×1100 (см. lib/garden/constants.ts). Шестиугольная сетка с шумом внутри овала,
-- без круга вокруг подсолнуха ОК10 в центре. Получается ≈ 2000 мест — больше, чем нужно на 1500 участников.
-- Меняете размеры мира — меняйте числа здесь и в constants.ts.
create or replace function public.generate_garden_slots()
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if exists (select 1 from public.plantings) then
    raise exception 'Нельзя пересоздать места: цветы уже посажены';
  end if;

  delete from public.garden_slots where true;

  with grid as (
    select (i * 26.0 + case when j % 2 = 1 then 13.0 else 0.0 end)::float8 as gx,
           (j * 22.0)::float8 as gy
    from generate_series(0, 79) as i, generate_series(0, 49) as j
  ), jit as (
    select gx + (random() - 0.5) * 0.7 * 26.0 as x,
           gy + (random() - 0.5) * 0.7 * 22.0 as y
    from grid
  ), pts as (
    select x, y from jit
    where power((x - 1000.0) / 900.0, 2) + power((y - 570.0) / 430.0, 2) <= 1     -- внутри овала
      and power((x - 1000.0) / 122.0, 2) + power((y - 448.0) / 128.0, 2) > 1      -- вне круга подсолнуха
  )
  insert into public.garden_slots (id, x, y, scale, rotation, variant)
  select (row_number() over (order by random()))::int,
         (x / 2000.0)::real,
         (y / 1100.0)::real,
         ((0.70 + 0.60 * least(1.0, greatest(0.0, (y - 140.0) / 860.0))) * (0.92 + random() * 0.16))::real,
         ((random() - 0.5) * 0.24)::real,
         floor(random() * 8)::smallint
  from pts;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.generate_garden_slots() from public, anon, authenticated;

select public.generate_garden_slots() where not exists (select 1 from public.garden_slots);
