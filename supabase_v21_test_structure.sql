-- TOEIC Study System V21
-- Add independent Test 1 / Test 2 identity to all question and audio records.
-- Existing records are migrated to Test 1 by the default value.
-- Run once in Supabase SQL Editor after deploying the V21 frontend.

begin;

-- Questions: the old rows all become Test 1.
alter table public.toeic_questions add column if not exists test_id smallint not null default 1;
alter table public.toeic_questions drop constraint if exists toeic_questions_test_id_check;
alter table public.toeic_questions add constraint toeic_questions_test_id_check check (test_id in (1,2));
alter table public.toeic_questions drop constraint if exists toeic_questions_set_id_question_id_key;
create unique index if not exists idx_toeic_questions_set_test_question
  on public.toeic_questions(set_id,test_id,question_id);
create index if not exists idx_toeic_questions_set_test_part
  on public.toeic_questions(set_id,test_id,part_id);

-- Deletion tombstones must distinguish same question number in different tests.
alter table public.toeic_question_deletions add column if not exists test_id smallint not null default 1;
alter table public.toeic_question_deletions drop constraint if exists toeic_question_deletions_pkey;
alter table public.toeic_question_deletions add constraint toeic_question_deletions_pkey primary key(set_id,test_id,question_id);
alter table public.toeic_question_deletions drop constraint if exists toeic_question_deletions_test_id_check;
alter table public.toeic_question_deletions add constraint toeic_question_deletions_test_id_check check(test_id in (1,2));

-- Audio file metadata and explicit question/audio references.
alter table public.toeic_audio_files add column if not exists test_id smallint not null default 1;
alter table public.toeic_audio_files drop constraint if exists toeic_audio_files_test_id_check;
alter table public.toeic_audio_files add constraint toeic_audio_files_test_id_check check(test_id in (1,2));

alter table public.toeic_question_audio add column if not exists test_id smallint not null default 1;
alter table public.toeic_question_audio drop constraint if exists toeic_question_audio_pkey;
drop index if exists public.idx_toeic_question_audio_one_audio_per_question;
alter table public.toeic_question_audio add constraint toeic_question_audio_pkey primary key(set_id,test_id,question_id,audio_id);
create unique index if not exists idx_toeic_question_audio_one_audio_per_question
  on public.toeic_question_audio(set_id,test_id,question_id);
create index if not exists idx_toeic_question_audio_audio_id
  on public.toeic_question_audio(audio_id);

alter table public.toeic_audio_cleanup_jobs add column if not exists test_id smallint not null default 1;
alter table public.toeic_audio_cleanup_jobs drop constraint if exists toeic_audio_cleanup_jobs_test_id_check;
alter table public.toeic_audio_cleanup_jobs add constraint toeic_audio_cleanup_jobs_test_id_check check(test_id in (1,2));

-- Remember both dimensions in the signed-in user's preference.
alter table public.toeic_user_preferences add column if not exists selected_test_id smallint not null default 1;
alter table public.toeic_user_preferences drop constraint if exists toeic_user_preferences_selected_test_id_check;
alter table public.toeic_user_preferences add constraint toeic_user_preferences_selected_test_id_check check(selected_test_id in (1,2));

-- Keep explicit audio references synchronized with the new composite identity.
create or replace function public.toeic_sync_question_audio_from_question()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_audio_id uuid; v_status text;
begin
  delete from public.toeic_question_audio
    where set_id=new.set_id and test_id=new.test_id and question_id=new.question_id;
  if coalesce(new.audio->>'type','')='cloud' then
    begin v_audio_id := nullif(new.audio->>'audioId','')::uuid;
    exception when others then v_audio_id := null; end;
    if v_audio_id is not null then
      select status into v_status from public.toeic_audio_files where id=v_audio_id;
      if v_status='active' then
        insert into public.toeic_question_audio(set_id,test_id,question_id,audio_id)
        values(new.set_id,new.test_id,new.question_id,v_audio_id) on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_toeic_sync_question_audio_from_question on public.toeic_questions;
create trigger trg_toeic_sync_question_audio_from_question
after insert or update of audio,set_id,test_id,question_id on public.toeic_questions
for each row execute function public.toeic_sync_question_audio_from_question();

-- Prevent resurrection only within the matching Test.
create or replace function public.toeic_guard_deleted_question_resurrection()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.toeic_question_deletions d
    where d.set_id=new.set_id and d.test_id=new.test_id and d.question_id=new.question_id) then
    return null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_toeic_guard_deleted_question_resurrection on public.toeic_questions;
create trigger trg_toeic_guard_deleted_question_resurrection
before insert or update on public.toeic_questions
for each row execute function public.toeic_guard_deleted_question_resurrection();

-- Atomically delete a question and only clean its audio when no other test/question references it.
create or replace function public.toeic_prepare_question_delete(p_set_id integer,p_test_id integer,p_question_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_audio_id uuid; v_path text; v_name text; v_refs integer:=0; v_job uuid; v_found boolean:=false;
begin
  if auth.uid() is null then raise exception '需要登录后才能删除题目'; end if;
  if p_test_id not in (1,2) then raise exception 'Test 编号无效'; end if;
  select true into v_found from public.toeic_questions
    where set_id=p_set_id and test_id=p_test_id and question_id=p_question_id for update;
  insert into public.toeic_question_deletions(set_id,test_id,question_id,deleted_by)
    values(p_set_id,p_test_id,p_question_id,auth.uid())
    on conflict(set_id,test_id,question_id) do update set deleted_at=now(),deleted_by=auth.uid();

  select a.id,a.storage_path,a.file_name into v_audio_id,v_path,v_name
    from public.toeic_question_audio r join public.toeic_audio_files a on a.id=r.audio_id
    where r.set_id=p_set_id and r.test_id=p_test_id and r.question_id=p_question_id
    order by a.created_at desc limit 1 for update of a;
  if v_audio_id is null then
    select id,storage_path,file_name into v_audio_id,v_path,v_name
      from public.toeic_audio_files where set_id=p_set_id and test_id=p_test_id and question_id=p_question_id
      order by created_at desc limit 1 for update;
  end if;

  if v_audio_id is not null then
    delete from public.toeic_question_audio
      where set_id=p_set_id and test_id=p_test_id and question_id=p_question_id and audio_id=v_audio_id;
  end if;
  delete from public.toeic_questions where set_id=p_set_id and test_id=p_test_id and question_id=p_question_id;

  if v_audio_id is not null then
    select count(*) into v_refs from public.toeic_question_audio where audio_id=v_audio_id;
    if v_refs=0 then
      select job_id into v_job from public.toeic_audio_cleanup_jobs
        where audio_id=v_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
      if v_job is null then
        update public.toeic_audio_files set status='deleting' where id=v_audio_id;
        insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,question_set_id,test_id,question_id,operation)
          values(v_audio_id,v_path,p_set_id,p_test_id,p_question_id,'delete_question_audio') returning job_id into v_job;
      end if;
    end if;
  end if;
  return jsonb_build_object('question_deleted',true,'already_missing',not coalesce(v_found,false),
    'audio_id',v_audio_id,'storage_path',v_path,'file_name',v_name,'references_remaining',v_refs,
    'delete_audio',(v_audio_id is not null and v_refs=0),'job_id',v_job);
end; $$;

-- V21 edit RPC: both source and destination identities include Test.
create or replace function public.toeic_save_question_edit(p_old_set_id integer,p_old_test_id integer,p_old_question_id text,p_new_question jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_new_set_id integer; v_new_test_id integer; v_new_part_id integer; v_new_question_id text;
  v_old_audio_id uuid; v_old_audio_path text; v_ref_count integer:=0; v_job_id uuid;
  v_changed_key boolean; v_found boolean:=false; v_audio jsonb; v_requested_audio_id uuid; v_audio_status text;
begin
  if auth.uid() is null then raise exception '请先登录后再修改题目'; end if;
  if p_old_set_id not between 1 and 16 or p_old_test_id not in (1,2) then raise exception '原套题/Test 编号无效'; end if;
  if jsonb_typeof(p_new_question) is distinct from 'object' then raise exception '题目数据格式无效'; end if;
  v_new_set_id := (p_new_question->>'set_id')::integer;
  v_new_test_id := coalesce((p_new_question->>'test_id')::integer,1);
  v_new_part_id := (p_new_question->>'part_id')::integer;
  v_new_question_id := nullif(trim(p_new_question->>'question_id'),'');
  v_audio := coalesce(p_new_question->'audio','{"type":"none"}'::jsonb);
  if coalesce(v_audio->>'type','')='cloud' then
    begin v_requested_audio_id := nullif(v_audio->>'audioId','')::uuid;
    exception when others then raise exception '云端音频 ID 格式无效'; end;
    select status into v_audio_status from public.toeic_audio_files where id=v_requested_audio_id for update;
    if v_audio_status is distinct from 'active' then raise exception '所选云端音频不存在或正在删除'; end if;
    select jsonb_build_object('type','cloud','audioId',id,'storagePath',storage_path,'fileName',file_name,'fileSize',file_size,'mimeType',mime_type)
      into v_audio from public.toeic_audio_files where id=v_requested_audio_id;
  end if;
  if v_new_set_id not between 1 and 16 or v_new_test_id not in (1,2) then raise exception '新套题/Test 编号无效'; end if;
  if v_new_part_id not between 1 and 7 or v_new_question_id is null then raise exception 'Part 或题号无效'; end if;

  select true into v_found from public.toeic_questions
    where set_id=p_old_set_id and test_id=p_old_test_id and question_id=p_old_question_id for update;
  if not coalesce(v_found,false) then raise exception '原题目不存在或已被其他设备删除'; end if;
  select r.audio_id into v_old_audio_id from public.toeic_question_audio r
    where r.set_id=p_old_set_id and r.test_id=p_old_test_id and r.question_id=p_old_question_id limit 1 for update;
  if v_old_audio_id is null then
    begin select nullif(q.audio->>'audioId','')::uuid into v_old_audio_id from public.toeic_questions q
      where q.set_id=p_old_set_id and q.test_id=p_old_test_id and q.question_id=p_old_question_id;
    exception when others then v_old_audio_id:=null; end;
  end if;
  if v_old_audio_id is not null then select storage_path into v_old_audio_path from public.toeic_audio_files where id=v_old_audio_id for update; end if;

  v_changed_key := p_old_set_id<>v_new_set_id or p_old_test_id<>v_new_test_id or p_old_question_id<>v_new_question_id;
  delete from public.toeic_question_deletions where set_id=v_new_set_id and test_id=v_new_test_id and question_id=v_new_question_id;
  if exists(select 1 from public.toeic_questions q where q.set_id=v_new_set_id and q.test_id=v_new_test_id
    and q.question_id=v_new_question_id and (v_changed_key or q.set_id<>p_old_set_id or q.test_id<>p_old_test_id or q.question_id<>p_old_question_id)) then
    raise exception '目标题号已存在';
  end if;

  insert into public.toeic_questions(set_id,test_id,part_id,question_id,title,options,correct_answer,audio,note,status,created_at,updated_at)
  values(v_new_set_id,v_new_test_id,v_new_part_id,v_new_question_id,coalesce(p_new_question->>'title',''),
    coalesce(p_new_question->'options','{}'::jsonb),coalesce(p_new_question->>'correct_answer',''),v_audio,
    coalesce(p_new_question->>'note',''),coalesce(p_new_question->>'status','unanswered'),
    coalesce(nullif(p_new_question->>'created_at','')::timestamptz,now()),
    coalesce(nullif(p_new_question->>'updated_at','')::timestamptz,now()))
  on conflict(set_id,test_id,question_id) do update set part_id=excluded.part_id,title=excluded.title,options=excluded.options,
    correct_answer=excluded.correct_answer,audio=excluded.audio,note=excluded.note,status=excluded.status,updated_at=excluded.updated_at;

  if v_changed_key then
    insert into public.toeic_question_deletions(set_id,test_id,question_id,deleted_by)
      values(p_old_set_id,p_old_test_id,p_old_question_id,auth.uid())
      on conflict(set_id,test_id,question_id) do update set deleted_at=now(),deleted_by=auth.uid();
    delete from public.toeic_question_audio where set_id=p_old_set_id and test_id=p_old_test_id and question_id=p_old_question_id;
    delete from public.toeic_questions where set_id=p_old_set_id and test_id=p_old_test_id and question_id=p_old_question_id;
  end if;

  if v_old_audio_id is not null and v_old_audio_path is not null then
    select count(*) into v_ref_count from public.toeic_question_audio where audio_id=v_old_audio_id;
    if v_ref_count=0 then
      select job_id into v_job_id from public.toeic_audio_cleanup_jobs
        where audio_id=v_old_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
      if v_job_id is null then
        update public.toeic_audio_files set status='deleting' where id=v_old_audio_id;
        insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,question_set_id,test_id,question_id,operation)
          values(v_old_audio_id,v_old_audio_path,p_old_set_id,p_old_test_id,p_old_question_id,'orphan_cleanup') returning job_id into v_job_id;
      end if;
    end if;
  end if;
  return jsonb_build_object('saved',true,'changed_key',v_changed_key,'old_audio_id',v_old_audio_id,
    'old_audio_references_remaining',v_ref_count,'cleanup_job_id',v_job_id);
end; $$;

-- Shared-audio deletion reports every referencing Test separately.
create or replace function public.toeic_prepare_shared_audio_delete(p_audio_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_path text; v_name text; v_refs jsonb; v_job uuid; v_count integer; v_audio_status text;
begin
  if auth.uid() is null then raise exception '需要登录'; end if;
  select storage_path,file_name,status into v_path,v_name,v_audio_status
    from public.toeic_audio_files where id=p_audio_id for update;
  if v_path is null then raise exception '云端音频不存在'; end if;
  if v_audio_status='deleting' then
    select job_id into v_job from public.toeic_audio_cleanup_jobs
      where audio_id=p_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
    if v_job is not null then return jsonb_build_object('job_id',v_job,'storage_path',v_path,'already_deleting',true); end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('set_id',r.set_id,'test_id',r.test_id,'question_id',r.question_id)
    order by r.set_id,r.test_id,r.question_id),'[]'::jsonb),count(*)
    into v_refs,v_count from public.toeic_question_audio r where r.audio_id=p_audio_id;
  update public.toeic_audio_files set status='deleting' where id=p_audio_id;
  update public.toeic_questions q set audio=jsonb_build_object('type','none','missingCloudAudioId',p_audio_id::text)
    where exists(select 1 from public.toeic_question_audio r where r.audio_id=p_audio_id
      and r.set_id=q.set_id and r.test_id=q.test_id and r.question_id=q.question_id);
  delete from public.toeic_question_audio where audio_id=p_audio_id;
  insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,operation)
    values(p_audio_id,v_path,'delete_shared_audio') returning job_id into v_job;
  return jsonb_build_object('job_id',v_job,'audio_id',p_audio_id,'storage_path',v_path,'file_name',v_name,'affected_count',v_count,'references',v_refs);
end; $$;

revoke all on function public.toeic_prepare_question_delete(integer,integer,text) from public,anon;
revoke all on function public.toeic_save_question_edit(integer,integer,text,jsonb) from public,anon;
revoke all on function public.toeic_prepare_shared_audio_delete(uuid) from public,anon;
grant execute on function public.toeic_prepare_question_delete(integer,integer,text) to authenticated;
grant execute on function public.toeic_save_question_edit(integer,integer,text,jsonb) to authenticated;
grant execute on function public.toeic_prepare_shared_audio_delete(uuid) to authenticated;

commit;
