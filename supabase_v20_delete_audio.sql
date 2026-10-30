-- TOEIC Study System V20
-- 安全删除题目、共享音频引用和 Storage 文件；所有已登录账号均可删除共享音频。
-- 请在 Supabase SQL Editor 中以项目管理员身份执行一次。依赖 V19 的 toeic_audio_files / toeic_questions / toeic-audio bucket。

create table if not exists public.toeic_question_deletions (
  set_id integer not null check (set_id between 1 and 16),
  question_id text not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id),
  primary key(set_id,question_id)
);
alter table public.toeic_question_deletions enable row level security;
grant select,delete on public.toeic_question_deletions to authenticated;
drop policy if exists "TOEIC question deletion tombstones read" on public.toeic_question_deletions;
drop policy if exists "TOEIC question deletion tombstones delete" on public.toeic_question_deletions;
create policy "TOEIC question deletion tombstones read" on public.toeic_question_deletions for select to authenticated using (true);
create policy "TOEIC question deletion tombstones delete" on public.toeic_question_deletions for delete to authenticated using (true);

-- V20 将共享题库权限统一收紧为 authenticated：所有已登录账号共享读写/删除，匿名角色不再可操作题库。
drop policy if exists "TOEIC public read questions" on public.toeic_questions;
drop policy if exists "TOEIC public insert questions" on public.toeic_questions;
drop policy if exists "TOEIC public update questions" on public.toeic_questions;
drop policy if exists "TOEIC public delete questions" on public.toeic_questions;
drop policy if exists "TOEIC authenticated shared read" on public.toeic_questions;
drop policy if exists "TOEIC authenticated shared insert" on public.toeic_questions;
drop policy if exists "TOEIC authenticated shared update" on public.toeic_questions;
drop policy if exists "TOEIC authenticated shared delete" on public.toeic_questions;
create policy "TOEIC authenticated shared read" on public.toeic_questions for select to authenticated using (true);
create policy "TOEIC authenticated shared insert" on public.toeic_questions for insert to authenticated with check (true);
create policy "TOEIC authenticated shared update" on public.toeic_questions for update to authenticated using (true) with check (true);
create policy "TOEIC authenticated shared delete" on public.toeic_questions for delete to authenticated using (true);
grant select,insert,update,delete on public.toeic_questions to authenticated;
revoke select,insert,update,delete on public.toeic_questions from anon;
grant usage,select on sequence public.toeic_questions_id_seq to authenticated;
revoke usage,select on sequence public.toeic_questions_id_seq from anon;

alter table public.toeic_audio_files add column if not exists status text not null default 'active';
alter table public.toeic_audio_files drop constraint if exists toeic_audio_files_status_check;
alter table public.toeic_audio_files add constraint toeic_audio_files_status_check check (status in ('active','deleting','failed'));

create table if not exists public.toeic_question_audio (
  set_id integer not null check (set_id between 1 and 16),
  question_id text not null,
  audio_id uuid not null references public.toeic_audio_files(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (set_id, question_id, audio_id)
);
create index if not exists idx_toeic_question_audio_audio on public.toeic_question_audio(audio_id);
alter table public.toeic_question_audio enable row level security;
grant select, insert, update, delete on public.toeic_question_audio to authenticated;
drop policy if exists "TOEIC shared question audio read" on public.toeic_question_audio;
drop policy if exists "TOEIC shared question audio write" on public.toeic_question_audio;
create policy "TOEIC shared question audio read" on public.toeic_question_audio for select to authenticated using (true);
create policy "TOEIC shared question audio write" on public.toeic_question_audio for all to authenticated using (true) with check (true);

create or replace function public.toeic_guard_question_audio_link()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  select status into v_status from public.toeic_audio_files where id=new.audio_id for update;
  if v_status is distinct from 'active' then raise exception '该音频正在删除或不可用，不能建立新关联'; end if;
  return new;
end; $$;
drop trigger if exists trg_toeic_guard_question_audio_link on public.toeic_question_audio;
create trigger trg_toeic_guard_question_audio_link before insert or update on public.toeic_question_audio
for each row execute function public.toeic_guard_question_audio_link();

create table if not exists public.toeic_audio_cleanup_jobs (
  job_id uuid primary key default gen_random_uuid(),
  audio_id uuid,
  storage_path text not null,
  question_set_id integer,
  question_id text,
  operation text not null check (operation in ('delete_question_audio','delete_shared_audio','orphan_cleanup')),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_toeic_audio_cleanup_status on public.toeic_audio_cleanup_jobs(status, created_at);
alter table public.toeic_audio_cleanup_jobs enable row level security;
grant select on public.toeic_audio_cleanup_jobs to authenticated;
drop policy if exists "TOEIC audio cleanup jobs read" on public.toeic_audio_cleanup_jobs;
create policy "TOEIC audio cleanup jobs read" on public.toeic_audio_cleanup_jobs for select to authenticated using (auth.uid() is not null);

-- 兼容 V19：优先从题目 JSON 中恢复真实引用（包括跨题共用），再用旧索引字段补齐。
insert into public.toeic_question_audio(set_id,question_id,audio_id)
select distinct q.set_id,q.question_id,a.id
from public.toeic_questions q
join public.toeic_audio_files a on q.audio->>'audioId'=a.id::text
where coalesce(q.audio->>'type','')='cloud'
on conflict do nothing;
insert into public.toeic_question_audio(set_id,question_id,audio_id)
select a.set_id,a.question_id,a.id from public.toeic_audio_files a
where not exists(select 1 from public.toeic_question_audio r where r.set_id=a.set_id and r.question_id=a.question_id)
on conflict do nothing;
create unique index if not exists idx_toeic_question_audio_one_audio_per_question on public.toeic_question_audio(set_id,question_id);

-- 删除墓碑阻止其他设备的旧静态题库/旧缓存把已删除题目重新同步回来。
create or replace function public.toeic_guard_deleted_question_resurrection()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.toeic_question_deletions d where d.set_id=new.set_id and d.question_id=new.question_id) then
    return null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_toeic_guard_deleted_question_resurrection on public.toeic_questions;
create trigger trg_toeic_guard_deleted_question_resurrection before insert or update on public.toeic_questions
for each row execute function public.toeic_guard_deleted_question_resurrection();

-- 防止旧设备把已删除/删除中的云端音频元数据重新同步回题目表。
create or replace function public.toeic_guard_question_audio_metadata()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_audio_id uuid; v_status text;
begin
  if coalesce(new.audio->>'type','')='cloud' then
    begin v_audio_id := nullif(new.audio->>'audioId','')::uuid; exception when others then v_audio_id := null; end;
    if v_audio_id is not null then
      select status into v_status from public.toeic_audio_files where id=v_audio_id;
      if v_status is distinct from 'active' then
        new.audio := jsonb_build_object('type','none','missingCloudAudioId',v_audio_id::text);
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_toeic_guard_question_audio_metadata on public.toeic_questions;
create trigger trg_toeic_guard_question_audio_metadata before insert or update of audio on public.toeic_questions
for each row execute function public.toeic_guard_question_audio_metadata();

-- 题目记录被新增/修改音频元数据时，同步维护显式引用关系，覆盖跨套题/跨题共用场景。
create or replace function public.toeic_sync_question_audio_from_question()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_audio_id uuid; v_status text;
begin
  delete from public.toeic_question_audio where set_id=new.set_id and question_id=new.question_id;
  if coalesce(new.audio->>'type','')='cloud' then
    begin v_audio_id := nullif(new.audio->>'audioId','')::uuid; exception when others then v_audio_id := null; end;
    if v_audio_id is not null then
      select status into v_status from public.toeic_audio_files where id=v_audio_id;
      if v_status='active' then
        insert into public.toeic_question_audio(set_id,question_id,audio_id) values(new.set_id,new.question_id,v_audio_id) on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_toeic_sync_question_audio_from_question on public.toeic_questions;
create trigger trg_toeic_sync_question_audio_from_question after insert or update of audio,set_id,question_id on public.toeic_questions
for each row execute function public.toeic_sync_question_audio_from_question();

-- 题目删除的数据库阶段：同一事务内解除关联、删除题目、创建持久化清理任务。
create or replace function public.toeic_prepare_question_delete(p_set_id integer,p_question_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_audio_id uuid; v_path text; v_name text; v_refs integer:=0; v_job uuid; v_found boolean:=false;
begin
  if auth.uid() is null then raise exception '需要登录后才能删除题目'; end if;
  select true into v_found from public.toeic_questions where set_id=p_set_id and question_id=p_question_id for update;
  insert into public.toeic_question_deletions(set_id,question_id,deleted_by) values(p_set_id,p_question_id,auth.uid()) on conflict(set_id,question_id) do update set deleted_at=now(),deleted_by=auth.uid();
  select a.id,a.storage_path,a.file_name into v_audio_id,v_path,v_name
    from public.toeic_question_audio r join public.toeic_audio_files a on a.id=r.audio_id
    where r.set_id=p_set_id and r.question_id=p_question_id order by a.created_at desc limit 1 for update of a;
  if v_audio_id is null then
    select id,storage_path,file_name into v_audio_id,v_path,v_name from public.toeic_audio_files
      where set_id=p_set_id and question_id=p_question_id order by created_at desc limit 1 for update;
  end if;
  if v_audio_id is not null then
    delete from public.toeic_question_audio where set_id=p_set_id and question_id=p_question_id and audio_id=v_audio_id;
  end if;
  delete from public.toeic_questions where set_id=p_set_id and question_id=p_question_id;
  if v_audio_id is not null then
    select count(*) into v_refs from public.toeic_question_audio where audio_id=v_audio_id;
    if v_refs=0 then
      select job_id into v_job from public.toeic_audio_cleanup_jobs where audio_id=v_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
      if v_job is null then
        update public.toeic_audio_files set status='deleting' where id=v_audio_id;
        insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,question_set_id,question_id,operation)
        values(v_audio_id,v_path,p_set_id,p_question_id,'delete_question_audio') returning job_id into v_job;
      end if;
    end if;
  end if;
  return jsonb_build_object('question_deleted',true,'already_missing',not coalesce(v_found,false),'audio_id',v_audio_id,'storage_path',v_path,'file_name',v_name,
    'references_remaining',v_refs,'delete_audio',(v_audio_id is not null and v_refs=0),'job_id',v_job);
end; $$;

-- 音频替换后旧音频若已无引用，排入清理队列；不会删除仍被其他题目使用的共享文件。
create or replace function public.toeic_queue_audio_cleanup_if_unreferenced(p_audio_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_path text; v_refs integer; v_job uuid;
begin
  if auth.uid() is null then raise exception '需要登录'; end if;
  select storage_path into v_path from public.toeic_audio_files where id=p_audio_id for update;
  if v_path is null then return jsonb_build_object('already_missing',true); end if;
  select count(*) into v_refs from public.toeic_question_audio where audio_id=p_audio_id;
  if v_refs>0 then return jsonb_build_object('deleted',false,'references_remaining',v_refs); end if;
  select job_id into v_job from public.toeic_audio_cleanup_jobs where audio_id=p_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
  if v_job is not null then return jsonb_build_object('job_id',v_job,'storage_path',v_path,'deleted',false,'existing_job',true); end if;
  update public.toeic_audio_files set status='deleting' where id=p_audio_id;
  insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,operation)
  values(p_audio_id,v_path,'orphan_cleanup') returning job_id into v_job;
  return jsonb_build_object('job_id',v_job,'storage_path',v_path,'deleted',false);
end; $$;

-- 任意登录账号可删除共享音频。先将引用题目标记为缺失并解除关联，再排入 Storage 清理任务。
create or replace function public.toeic_prepare_shared_audio_delete(p_audio_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_path text; v_name text; v_refs jsonb; v_job uuid; v_count integer; v_audio_status text;
begin
  if auth.uid() is null then raise exception '需要登录'; end if;
  select storage_path,file_name,status into v_path,v_name,v_audio_status from public.toeic_audio_files where id=p_audio_id for update;
  if v_path is null then raise exception '云端音频不存在'; end if;
  if v_audio_status='deleting' then
    select job_id into v_job from public.toeic_audio_cleanup_jobs where audio_id=p_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
    if v_job is not null then return jsonb_build_object('job_id',v_job,'storage_path',v_path,'already_deleting',true); end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('set_id',r.set_id,'question_id',r.question_id) order by r.set_id,r.question_id),'[]'::jsonb),count(*)
    into v_refs,v_count from public.toeic_question_audio r where r.audio_id=p_audio_id;
  update public.toeic_audio_files set status='deleting' where id=p_audio_id;
  update public.toeic_questions q set audio=jsonb_build_object('type','none','missingCloudAudioId',p_audio_id::text)
    where exists(select 1 from public.toeic_question_audio r where r.audio_id=p_audio_id and r.set_id=q.set_id and r.question_id=q.question_id);
  delete from public.toeic_question_audio where audio_id=p_audio_id;
  insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,operation)
    values(p_audio_id,v_path,'delete_shared_audio') returning job_id into v_job;
  return jsonb_build_object('job_id',v_job,'audio_id',p_audio_id,'storage_path',v_path,'file_name',v_name,'affected_count',v_count,'references',v_refs);
end; $$;

-- Storage 删除成功后才清理索引；失败时保留索引和任务供重试。
create or replace function public.toeic_finish_audio_cleanup(p_job_id uuid,p_success boolean,p_error text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_audio_id uuid; v_refs integer; v_status text;
begin
  if auth.uid() is null then raise exception '需要登录'; end if;
  select audio_id into v_audio_id from public.toeic_audio_cleanup_jobs where job_id=p_job_id for update;
  if not found then raise exception '清理任务不存在'; end if;
  if p_success then
    if v_audio_id is not null then
      select count(*) into v_refs from public.toeic_question_audio where audio_id=v_audio_id;
      if v_refs>0 then
        update public.toeic_audio_files set status='active' where id=v_audio_id;
        update public.toeic_audio_cleanup_jobs set status='failed',last_error='清理期间音频重新产生引用，已取消删除',attempts=attempts+1,last_attempt_at=now() where job_id=p_job_id;
        return jsonb_build_object('completed',false,'references_remaining',v_refs);
      end if;
      delete from public.toeic_audio_files where id=v_audio_id;
    end if;
    update public.toeic_audio_cleanup_jobs set status='completed',last_error=null,attempts=attempts+1,last_attempt_at=now(),completed_at=now() where job_id=p_job_id;
    return jsonb_build_object('completed',true);
  else
    update public.toeic_audio_files set status='failed' where id=v_audio_id;
    update public.toeic_audio_cleanup_jobs set status='failed',last_error=left(coalesce(p_error,'未知错误'),2000),attempts=attempts+1,last_attempt_at=now() where job_id=p_job_id;
    return jsonb_build_object('completed',false,'error',p_error);
  end if;
end; $$;

create or replace function public.toeic_claim_audio_cleanup_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_path text; v_status text;
begin
  if auth.uid() is null then raise exception '需要登录'; end if;
  update public.toeic_audio_cleanup_jobs set status='processing',attempts=attempts+1,last_attempt_at=now()
    where job_id=p_job_id and (status in ('pending','failed') or (status='processing' and last_attempt_at < now()-interval '10 minutes'))
    returning storage_path,status into v_path,v_status;
  if v_path is null then return jsonb_build_object('claimed',false); end if;
  return jsonb_build_object('claimed',true,'storage_path',v_path);
end; $$;

revoke all on function public.toeic_prepare_question_delete(integer,text) from public,anon;
revoke all on function public.toeic_queue_audio_cleanup_if_unreferenced(uuid) from public,anon;
revoke all on function public.toeic_prepare_shared_audio_delete(uuid) from public,anon;
revoke all on function public.toeic_finish_audio_cleanup(uuid,boolean,text) from public,anon;
revoke all on function public.toeic_claim_audio_cleanup_job(uuid) from public,anon;
grant execute on function public.toeic_prepare_question_delete(integer,text) to authenticated;
grant execute on function public.toeic_queue_audio_cleanup_if_unreferenced(uuid) to authenticated;
grant execute on function public.toeic_prepare_shared_audio_delete(uuid) to authenticated;
grant execute on function public.toeic_finish_audio_cleanup(uuid,boolean,text) to authenticated;
grant execute on function public.toeic_claim_audio_cleanup_job(uuid) to authenticated;
