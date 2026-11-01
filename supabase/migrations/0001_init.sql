-- 飲食記錄 App 初始資料表（PRD 第 5 節）
-- 在 Supabase Dashboard → SQL Editor 執行，或使用 supabase CLI `supabase db push`

-- ───────────── 家庭 ─────────────
create table households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default '我的家',
  ai_model text not null default 'claude-sonnet-5-5'
    check (ai_model in ('claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5')),
  created_at timestamptz not null default now()
);

-- 目前登入者所屬的家庭
create function current_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from households where owner_user_id = auth.uid()
$$;

-- 在 Supabase 後台建立帳號時自動建立家庭
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into households (owner_user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────── 成員與體重 ─────────────
create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default current_household_id() references households (id) on delete cascade,
  name text not null,
  sex text not null check (sex in ('male', 'female')),
  birth_year_month text not null check (birth_year_month ~ '^\d{4}-\d{2}$'),
  height_cm numeric(5, 1) not null check (height_cm > 0),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active')),
  goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain')),
  diet_note text,
  calorie_target_override integer check (calorie_target_override > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 1) not null check (weight_kg > 0),
  created_at timestamptz not null default now()
);
create index weight_logs_member_date on weight_logs (member_id, date desc);

-- ───────────── 飲食記錄 ─────────────
create table entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  note text,
  status text not null default 'pending' check (status in ('pending', 'analyzing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entries_member_date on entries (member_id, date);

create table entry_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries (id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0
);

create table entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries (id) on delete cascade,
  name text not null,
  portion text not null,
  kcal integer not null check (kcal >= 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carbs_g numeric(6, 1) not null check (carbs_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  sort_order smallint not null default 0
);

-- ───────────── 每日總結 ─────────────
create table daily_summaries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  date date not null,
  content text not null,
  generated_at timestamptz not null default now(),
  is_stale boolean not null default false,
  unique (member_id, date)
);

-- 當日記錄或品項變動時，把總結標記為過期（PRD 3.6）
create function mark_summary_stale() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e entries%rowtype;
begin
  if tg_table_name = 'entries' then
    e := coalesce(new, old);
  else
    select * into e from entries where id = coalesce(new.entry_id, old.entry_id);
  end if;
  update daily_summaries set is_stale = true
    where member_id = e.member_id and date = e.date;
  -- 記錄改了日期或成員時，原本那天的總結也過期
  if tg_table_name = 'entries' and tg_op = 'UPDATE' then
    update daily_summaries set is_stale = true
      where member_id = old.member_id and date = old.date;
  end if;
  return null;
end;
$$;

create trigger entries_mark_stale
  after insert or update or delete on entries
  for each row execute function mark_summary_stale();

create trigger entry_items_mark_stale
  after insert or update or delete on entry_items
  for each row execute function mark_summary_stale();

-- ───────────── AI 用量 ─────────────
create table ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default current_household_id() references households (id) on delete cascade,
  model text not null,
  purpose text not null check (purpose in ('recognize', 're_estimate', 'summary')),
  input_tokens integer not null,
  output_tokens integer not null,
  cost_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);
create index ai_usage_logs_household_created on ai_usage_logs (household_id, created_at);

-- ───────────── Row Level Security ─────────────
alter table households enable row level security;
alter table members enable row level security;
alter table weight_logs enable row level security;
alter table entries enable row level security;
alter table entry_photos enable row level security;
alter table entry_items enable row level security;
alter table daily_summaries enable row level security;
alter table ai_usage_logs enable row level security;

create policy "own household" on households
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "household members" on members
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create function is_household_member(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = mid and household_id = current_household_id())
$$;

create policy "household weight logs" on weight_logs
  for all using (is_household_member(member_id)) with check (is_household_member(member_id));

create policy "household entries" on entries
  for all using (is_household_member(member_id)) with check (is_household_member(member_id));

create policy "household entry photos" on entry_photos
  for all using (exists (select 1 from entries e where e.id = entry_id and is_household_member(e.member_id)))
  with check (exists (select 1 from entries e where e.id = entry_id and is_household_member(e.member_id)));

create policy "household entry items" on entry_items
  for all using (exists (select 1 from entries e where e.id = entry_id and is_household_member(e.member_id)))
  with check (exists (select 1 from entries e where e.id = entry_id and is_household_member(e.member_id)));

create policy "household summaries" on daily_summaries
  for all using (is_household_member(member_id)) with check (is_household_member(member_id));

create policy "household ai usage" on ai_usage_logs
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- ───────────── 照片儲存 ─────────────
-- 私有 bucket，路徑格式：{household_id}/{entry_id}/{檔名}.jpg
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false);

create policy "household photos" on storage.objects
  for all using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = current_household_id()::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = current_household_id()::text
  );
