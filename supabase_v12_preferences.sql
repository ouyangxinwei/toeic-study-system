-- TOEIC Study System V12: 当前显示套题偏好设置
-- 在 Supabase Dashboard -> SQL Editor 中执行一次。
-- 每个已登录用户只保存自己的 selected_set_id（1-16）。

create table if not exists public.toeic_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_set_id integer not null default 1 check (selected_set_id between 1 and 16),
  updated_at timestamptz not null default now()
);

alter table public.toeic_user_preferences enable row level security;

drop policy if exists "Users can read own TOEIC preferences" on public.toeic_user_preferences;
create policy "Users can read own TOEIC preferences"
  on public.toeic_user_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own TOEIC preferences" on public.toeic_user_preferences;
create policy "Users can insert own TOEIC preferences"
  on public.toeic_user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own TOEIC preferences" on public.toeic_user_preferences;
create policy "Users can update own TOEIC preferences"
  on public.toeic_user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.toeic_user_preferences to authenticated;
