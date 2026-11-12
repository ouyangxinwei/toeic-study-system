-- V21.1 post-migration hardening
-- Safe to run after supabase_v21_test_structure.sql.
-- These functions are trigger-only; callers must not invoke them through PostgREST RPC.
begin;
revoke all on function public.toeic_guard_deleted_question_resurrection() from public, anon, authenticated;
revoke all on function public.toeic_sync_question_audio_from_question() from public, anon, authenticated;
revoke all on function public.toeic_guard_question_audio_link() from public, anon, authenticated;
revoke all on function public.toeic_guard_question_audio_metadata() from public, anon, authenticated;
-- The following two indexes are identical; retain idx_toeic_question_audio_audio_id.
drop index if exists public.idx_toeic_question_audio_audio;
commit;
