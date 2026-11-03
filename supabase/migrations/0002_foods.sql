-- 食物庫（PRD 3.9）：官方食物（household_id 為 null）與家庭自訂食物
-- 在 Supabase Dashboard → SQL Editor 執行，接著執行 0003_tfda_foods.sql 匯入官方資料

create table foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid default current_household_id() references households (id) on delete cascade,
  source text not null check (source in ('tfda', 'custom')),
  source_code text,
  name text not null,
  aliases text,
  category text,
  description text,
  -- 營養素以「基準份量」計：官方資料為 100g；自訂食物可以是「1 瓶」，克數未知時 base_grams 為 null
  base_label text not null,
  base_grams numeric(7, 1) check (base_grams > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carbs_g numeric(6, 1) not null check (carbs_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  check ((source = 'tfda') = (household_id is null))
);
create index foods_household on foods (household_id);

-- 常用單位：household_id 為 null 表示預設（在 SQL Editor 匯入時 current_household_id() 為 null），家庭可以自己加
create table food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods (id) on delete cascade,
  household_id uuid default current_household_id() references households (id) on delete cascade,
  label text not null,
  grams numeric(7, 1) not null check (grams > 0)
);
create index food_portions_food on food_portions (food_id);

alter table entry_items add column food_id uuid references foods (id) on delete set null;
create index entry_items_food on entry_items (food_id);

-- ───────────── Row Level Security ─────────────
alter table foods enable row level security;
alter table food_portions enable row level security;

create policy "read official and household foods" on foods
  for select using (household_id is null or household_id = current_household_id());
create policy "manage household foods" on foods
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id() and source = 'custom');

create policy "read portions" on food_portions
  for select using (household_id is null or household_id = current_household_id());
create policy "manage household portions" on food_portions
  for all using (household_id = current_household_id())
  with check (
    household_id = current_household_id()
    and exists (
      select 1 from foods f where f.id = food_id
        and (f.household_id is null or f.household_id = current_household_id())
    )
  );

-- 搜尋食物：名稱或俗名包含關鍵字，家庭自訂優先，其次名稱越短越前面
create function search_foods(q text, max_results int default 30)
returns setof foods
language sql stable set search_path = public as $$
  select * from foods
  where (household_id is null or household_id = current_household_id())
    and (name ilike '%' || q || '%' or aliases ilike '%' || q || '%')
  order by
    household_id is null,
    name ilike q || '%' desc,
    name ilike '%' || q || '%' desc,
    length(name),
    name
  limit max_results
$$;

-- 成員最近常吃的食物：最近 60 天內吃過的次數排序，附上最後一次的份量與營養素
create function recent_foods(mid uuid, max_results int default 12)
returns table (
  food_id uuid, name text, portion text,
  kcal integer, protein_g numeric, carbs_g numeric, fat_g numeric, times bigint
)
language sql stable set search_path = public as $$
  with used as (
    select i.*, e.created_at as eaten_at
    from entry_items i
    join entries e on e.id = i.entry_id
    where e.member_id = mid
      and is_household_member(mid)
      and e.status = 'ready'
      and i.food_id is not null
      and e.date >= (now() at time zone 'Asia/Taipei')::date - 60
  ),
  latest as (
    select distinct on (food_id) * from used order by food_id, eaten_at desc, sort_order
  )
  select l.food_id, l.name, l.portion, l.kcal, l.protein_g, l.carbs_g, l.fat_g,
    (select count(*) from used u where u.food_id = l.food_id) as times
  from latest l
  order by times desc, l.eaten_at desc
  limit max_results
$$;
