-- V19 云端音频存储：所有已登录账号共享；未登录用户不可访问。
-- 在 Supabase Dashboard -> SQL Editor 中以管理员身份执行一次。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toeic-audio', 'toeic-audio', false, 20971520,
        array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/webm'])
on conflict (id) do update set public=false, file_size_limit=20971520,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.toeic_audio_files (
  id uuid primary key,
  question_id text not null,
  set_id integer not null check (set_id between 1 and 16),
  part_id integer not null check (part_id between 1 and 7),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_toeic_audio_set_question on public.toeic_audio_files(set_id, question_id);
create index if not exists idx_toeic_audio_storage_path on public.toeic_audio_files(storage_path);
alter table public.toeic_audio_files enable row level security;
grant select, insert, update, delete on public.toeic_audio_files to authenticated;

drop policy if exists "TOEIC audio shared read" on public.toeic_audio_files;
drop policy if exists "TOEIC audio shared insert" on public.toeic_audio_files;
drop policy if exists "TOEIC audio shared update" on public.toeic_audio_files;
drop policy if exists "TOEIC audio shared delete" on public.toeic_audio_files;
create policy "TOEIC audio shared read" on public.toeic_audio_files for select to authenticated using (true);
create policy "TOEIC audio shared insert" on public.toeic_audio_files for insert to authenticated with check (uploaded_by = auth.uid());
create policy "TOEIC audio shared update" on public.toeic_audio_files for update to authenticated using (true) with check (true);
create policy "TOEIC audio shared delete" on public.toeic_audio_files for delete to authenticated using (true);

-- 所有已登录账号共享音频文件：共享目录 shared/ 下允许 authenticated 读写。
drop policy if exists "TOEIC audio objects shared read" on storage.objects;
drop policy if exists "TOEIC audio objects shared insert" on storage.objects;
drop policy if exists "TOEIC audio objects shared update" on storage.objects;
drop policy if exists "TOEIC audio objects shared delete" on storage.objects;
create policy "TOEIC audio objects shared read" on storage.objects for select to authenticated using (bucket_id='toeic-audio' and (storage.foldername(name))[1]='shared');
create policy "TOEIC audio objects shared insert" on storage.objects for insert to authenticated with check (bucket_id='toeic-audio' and (storage.foldername(name))[1]='shared');
create policy "TOEIC audio objects shared update" on storage.objects for update to authenticated using (bucket_id='toeic-audio' and (storage.foldername(name))[1]='shared') with check (bucket_id='toeic-audio' and (storage.foldername(name))[1]='shared');
create policy "TOEIC audio objects shared delete" on storage.objects for delete to authenticated using (bucket_id='toeic-audio' and (storage.foldername(name))[1]='shared');
