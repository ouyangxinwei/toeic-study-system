-- V14: allow deleting TOEIC questions and verify actual deletion
-- Run this in Supabase Dashboard -> SQL Editor.
-- This follows the current project policy style (authenticated/anon access).

drop policy if exists "TOEIC public delete questions" on public.toeic_questions;
create policy "TOEIC public delete questions"
on public.toeic_questions
for delete
to anon, authenticated
using (true);

grant delete on public.toeic_questions to anon, authenticated;
