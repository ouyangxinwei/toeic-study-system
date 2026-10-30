-- TOEIC Study System V20.1
-- 题目编辑时原子更新题目与音频引用；每题一段音频，可被多题共享。
-- 依赖：V20 supabase_v20_delete_audio.sql 已执行。

begin;
create unique index if not exists idx_toeic_question_audio_one_audio_per_question on public.toeic_question_audio(set_id, question_id);
create index if not exists idx_toeic_question_audio_audio_id on public.toeic_question_audio(audio_id);

-- 前端支持“已复习”状态，数据库约束同步允许该值。
alter table public.toeic_questions drop constraint if exists toeic_questions_status_check;
alter table public.toeic_questions add constraint toeic_questions_status_check check (status in ('unanswered','wrong','correct','reviewed','mastered'));

create or replace function public.toeic_save_question_edit(p_old_set_id integer,p_old_question_id text,p_new_question jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_new_set_id integer; v_new_part_id integer; v_new_question_id text;
  v_old_audio_id uuid; v_old_audio_path text; v_ref_count integer:=0;
  v_job_id uuid; v_changed_key boolean; v_found boolean:=false; v_audio jsonb; v_requested_audio_id uuid; v_audio_status text;
begin
  if auth.uid() is null then raise exception '请先登录后再修改题目'; end if;
  if p_old_set_id not between 1 and 16 then raise exception '原套题编号无效'; end if;
  if jsonb_typeof(p_new_question) is distinct from 'object' then raise exception '题目数据格式无效'; end if;
  v_new_set_id := (p_new_question->>'set_id')::integer;
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
  if v_new_set_id not between 1 and 16 then raise exception '新套题编号必须为1至16'; end if;
  if v_new_part_id not between 1 and 7 then raise exception 'Part 编号必须为1至7'; end if;
  if v_new_question_id is null then raise exception '题号不能为空'; end if;

  select true into v_found from public.toeic_questions where set_id=p_old_set_id and question_id=p_old_question_id for update;
  if not coalesce(v_found,false) then raise exception '原题目不存在或已被其他设备删除'; end if;
  select r.audio_id into v_old_audio_id from public.toeic_question_audio r where r.set_id=p_old_set_id and r.question_id=p_old_question_id limit 1 for update;
  if v_old_audio_id is null then
    begin select nullif(q.audio->>'audioId','')::uuid into v_old_audio_id from public.toeic_questions q where q.set_id=p_old_set_id and q.question_id=p_old_question_id;
    exception when others then v_old_audio_id:=null; end;
  end if;
  if v_old_audio_id is not null then select storage_path into v_old_audio_path from public.toeic_audio_files where id=v_old_audio_id for update; end if;

  v_changed_key := p_old_set_id<>v_new_set_id or p_old_question_id<>v_new_question_id;
  delete from public.toeic_question_deletions where set_id=v_new_set_id and question_id=v_new_question_id;
  if exists(select 1 from public.toeic_questions q where q.set_id=v_new_set_id and q.question_id=v_new_question_id and (v_changed_key or q.set_id<>p_old_set_id or q.question_id<>p_old_question_id)) then
    raise exception '目标题号已存在';
  end if;

  insert into public.toeic_questions(set_id,part_id,question_id,title,options,correct_answer,audio,note,status,created_at,updated_at)
  values(v_new_set_id,v_new_part_id,v_new_question_id,coalesce(p_new_question->>'title',''),coalesce(p_new_question->'options','{}'::jsonb),coalesce(p_new_question->>'correct_answer',''),v_audio,coalesce(p_new_question->>'note',''),coalesce(p_new_question->>'status','unanswered'),coalesce(nullif(p_new_question->>'created_at','')::timestamptz,now()),coalesce(nullif(p_new_question->>'updated_at','')::timestamptz,now()))
  on conflict(set_id,question_id) do update set part_id=excluded.part_id,title=excluded.title,options=excluded.options,correct_answer=excluded.correct_answer,audio=excluded.audio,note=excluded.note,status=excluded.status,updated_at=excluded.updated_at;

  if v_changed_key then
    insert into public.toeic_question_deletions(set_id,question_id,deleted_by) values(p_old_set_id,p_old_question_id,auth.uid())
      on conflict(set_id,question_id) do update set deleted_at=now(),deleted_by=auth.uid();
    delete from public.toeic_question_audio where set_id=p_old_set_id and question_id=p_old_question_id;
    delete from public.toeic_questions where set_id=p_old_set_id and question_id=p_old_question_id;
  end if;

  if v_old_audio_id is not null and v_old_audio_path is not null then
    select count(*) into v_ref_count from public.toeic_question_audio where audio_id=v_old_audio_id;
    if v_ref_count=0 then
      select job_id into v_job_id from public.toeic_audio_cleanup_jobs where audio_id=v_old_audio_id and status in ('pending','processing','failed') order by created_at desc limit 1;
      if v_job_id is null then
        update public.toeic_audio_files set status='deleting' where id=v_old_audio_id;
        insert into public.toeic_audio_cleanup_jobs(audio_id,storage_path,question_set_id,question_id,operation)
          values(v_old_audio_id,v_old_audio_path,p_old_set_id,p_old_question_id,'orphan_cleanup') returning job_id into v_job_id;
      end if;
    end if;
  end if;
  return jsonb_build_object('saved',true,'changed_key',v_changed_key,'old_audio_id',v_old_audio_id,'old_audio_references_remaining',v_ref_count,'cleanup_job_id',v_job_id);
end; $$;
revoke all on function public.toeic_save_question_edit(integer,text,jsonb) from public,anon;
grant execute on function public.toeic_save_question_edit(integer,text,jsonb) to authenticated;
commit;
