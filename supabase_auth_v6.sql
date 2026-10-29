-- TOEIC Study System V6: Supabase Auth 用户资料与题库权限
-- 在 Supabase Dashboard -> SQL Editor 执行。
-- 重要：SQL 不会也不应直接写入明文密码到自建表。
-- 请先在 Authentication -> Users -> Add user 中创建：
-- Email: oooo@example.com
-- Password: 683253
-- 若界面提供选项，请启用/确认 Email Confirmed（无需邮件验证）。

create table if not exists public.toeic_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.toeic_profiles enable row level security;
revoke all on public.toeic_profiles from anon;
grant select on public.toeic_profiles to authenticated;
drop policy if exists "Users can read own TOEIC profile" on public.toeic_profiles;
create policy "Users can read own TOEIC profile"
  on public.toeic_profiles for select to authenticated
  using (auth.uid() = id);

-- 在创建 Auth 用户后执行此语句，把用户名 oooo 绑定到 Auth 用户。
insert into public.toeic_profiles (id, username)
select id, 'oooo' from auth.users where lower(email) = 'oooo@example.com'
on conflict (id) do update set username = excluded.username;

-- 把题库权限收紧为必须登录。现有题目数据不会被删除。
revoke all on public.toeic_questions from anon;
grant select, insert, update on public.toeic_questions to authenticated;
grant usage, select on sequence public.toeic_questions_id_seq to authenticated;

 drop policy if exists "TOEIC public read questions" on public.toeic_questions;
 drop policy if exists "TOEIC public insert questions" on public.toeic_questions;
 drop policy if exists "TOEIC public update questions" on public.toeic_questions;
 drop policy if exists "TOEIC authenticated read questions" on public.toeic_questions;
 drop policy if exists "TOEIC authenticated insert questions" on public.toeic_questions;
 drop policy if exists "TOEIC authenticated update questions" on public.toeic_questions;
create policy "TOEIC authenticated read questions" on public.toeic_questions
  for select to authenticated using (true);
create policy "TOEIC authenticated insert questions" on public.toeic_questions
  for insert to authenticated with check (true);
create policy "TOEIC authenticated update questions" on public.toeic_questions
  for update to authenticated using (true) with check (true);
