-- TOEIC Study System V16: add Set 16 and import 100 original TOEIC-style Listening practice questions.
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- Original practice material; not copied from official TOEIC test forms. Audio files are not included.

begin;
do $$ declare c record; begin
  -- Remove only the set_id range CHECK constraint, then replace it with 1..16.
  for c in select conname from pg_constraint where conrelid='public.toeic_questions'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%set_id%' loop
    execute format('alter table public.toeic_questions drop constraint %I', c.conname);
  end loop;
  alter table public.toeic_questions add constraint toeic_questions_set_id_check check (set_id between 1 and 16);
end $$;

do $$ declare c record; begin
  if to_regclass('public.toeic_user_preferences') is not null then
    for c in select conname from pg_constraint where conrelid='public.toeic_user_preferences'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%selected_set_id%' loop
      execute format('alter table public.toeic_user_preferences drop constraint %I', c.conname);
    end loop;
    alter table public.toeic_user_preferences add constraint toeic_user_preferences_selected_set_id_check check (selected_set_id between 1 and 16);
  end if;
end $$;

-- Exactly 100 rows: Part 1=6, Part 2=25, Part 3=39, Part 4=30.
insert into public.toeic_questions (set_id, part_id, question_id, title, options, correct_answer, audio, note, status, created_at, updated_at) values
(16, 1, '16-1-001', 'Photo scene: A technician is kneeling beside an open server cabinet in an office.', '{"A":"A technician is repairing equipment in a server room.","B":"A worker is carrying a cabinet out of the building.","C":"Several employees are installing ceiling lights.","D":"A customer is waiting at a reception desk."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 1, '16-1-002', 'Photo scene: Several chairs have been arranged around a long table.', '{"A":"The chairs are being loaded onto a truck.","B":"A meeting room has been prepared for a conference.","C":"People are eating lunch at the table.","D":"A table is being moved through a doorway."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 1, '16-1-003', 'Photo scene: A woman is placing folders into a filing cabinet.', '{"A":"A woman is signing for a package.","B":"A woman is taking books off a shelf.","C":"A woman is organizing documents in a cabinet.","D":"A woman is cleaning a computer screen."}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 1, '16-1-004', 'Photo scene: Two employees are looking at a large display in a showroom.', '{"A":"They are painting a wall together.","B":"They are checking a delivery outside.","C":"They are assembling office furniture.","D":"They are examining a product display."}'::jsonb, 'D', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 1, '16-1-005', 'Photo scene: A delivery worker is pushing a cart loaded with boxes down a corridor.', '{"A":"A worker is transporting packages on a cart.","B":"A worker is sweeping the corridor.","C":"A worker is opening a window.","D":"A worker is stacking chairs."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 1, '16-1-006', 'Photo scene: A cyclist is locking a bicycle to a rack near an office building.', '{"A":"A cyclist is repairing a flat tire.","B":"A person is securing a bicycle to a rack.","C":"A person is washing a car.","D":"A cyclist is entering a sports shop."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-001', 'When will the revised budget be ready?', '{"A":"By the end of the day.","B":"It was a very useful meeting.","C":"The budget is in the blue folder."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-002', 'Why has the shipment been delayed?', '{"A":"At the loading dock.","B":"The supplier ran out of a key component.","C":"It weighs about twenty kilograms."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-003', 'Could you send me the minutes from yesterday’s meeting?', '{"A":"Certainly; I’ll email them this afternoon.","B":"The meeting room seats twelve.","C":"Yes, yesterday was unusually busy."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-004', 'Who is leading the training session next week?', '{"A":"In the main conference room.","B":"It lasts about two hours.","C":"Ms. Patel from Human Resources."}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-005', 'Have you made a reservation for the client dinner?', '{"A":"Not yet, but I’ll call the restaurant now.","B":"The client arrived by train.","C":"Dinner was served at six."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-006', 'The printer on the third floor isn’t working.', '{"A":"The report is due on Friday.","B":"I’ll contact the IT help desk.","C":"There are three floors in this building."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-007', 'How often does the airport shuttle leave?', '{"A":"Every thirty minutes.","B":"At the international terminal.","C":"I took a taxi yesterday."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-008', 'Would you prefer the window seat or the aisle seat?', '{"A":"The flight was delayed.","B":"An aisle seat, if one is available.","C":"I prefer to travel in June."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-009', 'Why don’t we move the presentation to Thursday?', '{"A":"That should give everyone more time to prepare.","B":"The presentation is on the screen.","C":"Thursday’s weather was sunny."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-010', 'Where should I leave these signed contracts?', '{"A":"They were signed this morning.","B":"Please put them on Mr. Chen’s desk.","C":"The contract covers two years."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-011', 'Did the maintenance team inspect the air conditioner?', '{"A":"Yes, they checked it before lunch.","B":"The air is quite dry today.","C":"The team has six members."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-012', 'Who approved the travel expenses?', '{"A":"They were higher than expected.","B":"The trip lasted four days.","C":"Our department manager did."}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-013', 'Could we get a larger room for the workshop?', '{"A":"I’ll check whether the training room is available.","B":"The workshop begins at nine.","C":"A room key is on the counter."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-014', 'Is the new employee familiar with the inventory software?', '{"A":"The inventory was counted yesterday.","B":"She used a similar system at her last job.","C":"The employee handbook is online."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-015', 'When are you planning to update the website?', '{"A":"The design team is finishing the new graphics today.","B":"It has several useful pages.","C":"I visited the website last night."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-016', 'You haven’t submitted the mileage form yet, have you?', '{"A":"The mileage is about forty kilometers.","B":"No, I’ll submit it before I leave.","C":"The form is printed in color."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-017', 'Why is the front entrance closed?', '{"A":"Please use the side entrance during repairs.","B":"The front desk opens at eight.","C":"It’s located across from the bank."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-018', 'Would you mind covering the reception desk during my break?', '{"A":"The reception area was renovated.","B":"Not at all; just let me know when you’re leaving.","C":"I usually take my break at noon."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-019', 'How did the job interview go?', '{"A":"The job posting is still online.","B":"At the downtown office.","C":"I think the panel was pleased with my presentation."}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-020', 'Has anyone confirmed attendance for the seminar?', '{"A":"We’ve received replies from most of the speakers.","B":"The seminar room is on the second floor.","C":"I attended a seminar last month."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-021', 'Could you tell me which platform the train departs from?', '{"A":"The train is quite comfortable.","B":"Platform six, according to the display.","C":"It takes an hour to get there."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-022', 'Why don’t we order the replacement parts today?', '{"A":"The parts are made of steel.","B":"I ordered lunch for the team.","C":"Good idea; delivery usually takes three days."}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-023', 'Do you know whether the invoice includes installation?', '{"A":"I’ll check the itemized quotation.","B":"The invoice was mailed yesterday.","C":"Installation took two hours."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-024', 'Who will be responsible for updating the contact list?', '{"A":"The list contains outdated numbers.","B":"Jordan volunteered to handle it.","C":"It is listed alphabetically."}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 2, '16-2-025', 'Would you like me to print copies of the agenda?', '{"A":"Yes, please make ten copies.","B":"The agenda was discussed yesterday.","C":"I like the new printer."}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-001', 'Conversation 1 — Office renovation
Woman: The contractor says the conference room will be unavailable until Wednesday.
Man: That affects our supplier meeting on Tuesday.
Woman: I can reserve the smaller room and set up a video call for anyone who cannot fit.
Man: Great. I’ll notify the suppliers and send the updated invitation.
Question 1: What are the speakers discussing?', '{"A":"A change to a meeting location","B":"A new supplier contract","C":"A delayed product launch","D":"A staff training policy"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-002', 'Conversation 1 — Office renovation
Woman: The contractor says the conference room will be unavailable until Wednesday.
Man: That affects our supplier meeting on Tuesday.
Woman: I can reserve the smaller room and set up a video call for anyone who cannot fit.
Man: Great. I’ll notify the suppliers and send the updated invitation.
Question 2: What does the woman offer to do?', '{"A":"Order new office chairs","B":"Reserve another room","C":"Contact the contractor’s manager","D":"Cancel the supplier meeting"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-003', 'Conversation 1 — Office renovation
Woman: The contractor says the conference room will be unavailable until Wednesday.
Man: That affects our supplier meeting on Tuesday.
Woman: I can reserve the smaller room and set up a video call for anyone who cannot fit.
Man: Great. I’ll notify the suppliers and send the updated invitation.
Question 3: What will the man do?', '{"A":"Prepare a cost estimate","B":"Repair the conference room","C":"Inform the suppliers","D":"Arrange transportation"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-004', 'Conversation 2 — Customer order
Man: I’m calling about order 4821. The tracking page says it was delivered, but nothing arrived.
Woman: I’m sorry about that. The carrier’s photo shows it was left at the neighboring office.
Man: I’ll check with them. If it isn’t there, could you arrange another shipment?
Woman: Certainly. I’ll keep the case open until you confirm.
Question 1: Why is the man calling?', '{"A":"To change a billing address","B":"To report a missing delivery","C":"To request a product catalog","D":"To cancel an order"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-005', 'Conversation 2 — Customer order
Man: I’m calling about order 4821. The tracking page says it was delivered, but nothing arrived.
Woman: I’m sorry about that. The carrier’s photo shows it was left at the neighboring office.
Man: I’ll check with them. If it isn’t there, could you arrange another shipment?
Woman: Certainly. I’ll keep the case open until you confirm.
Question 2: What does the woman say about the package?', '{"A":"It was returned to the warehouse","B":"It is waiting at a pickup center","C":"It may have been left at another office","D":"It was shipped to the wrong city"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-006', 'Conversation 2 — Customer order
Man: I’m calling about order 4821. The tracking page says it was delivered, but nothing arrived.
Woman: I’m sorry about that. The carrier’s photo shows it was left at the neighboring office.
Man: I’ll check with them. If it isn’t there, could you arrange another shipment?
Woman: Certainly. I’ll keep the case open until you confirm.
Question 3: What will the woman do?', '{"A":"Keep the case open","B":"Issue a refund immediately","C":"Call the neighboring office","D":"Send a new invoice"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-007', 'Conversation 3 — Staff scheduling
Woman: Two people have requested Friday off, but we need three staff members at the information desk.
Man: I can switch my day off to Monday if that helps.
Woman: That would solve the problem. I’ll update the rota and tell the supervisor.
Man: Please do; I’ll also let the team know.
Question 1: What problem do the speakers discuss?', '{"A":"A shortage of desk staff on Friday","B":"A delayed payroll payment","C":"A broken information desk","D":"A supervisor’s resignation"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-008', 'Conversation 3 — Staff scheduling
Woman: Two people have requested Friday off, but we need three staff members at the information desk.
Man: I can switch my day off to Monday if that helps.
Woman: That would solve the problem. I’ll update the rota and tell the supervisor.
Man: Please do; I’ll also let the team know.
Question 2: What does the man offer to do?', '{"A":"Work an extra evening shift","B":"Change his day off","C":"Train a new employee","D":"Cover the weekend shift"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-009', 'Conversation 3 — Staff scheduling
Woman: Two people have requested Friday off, but we need three staff members at the information desk.
Man: I can switch my day off to Monday if that helps.
Woman: That would solve the problem. I’ll update the rota and tell the supervisor.
Man: Please do; I’ll also let the team know.
Question 3: What will the woman update?', '{"A":"The employee handbook","B":"The customer list","C":"The work schedule","D":"The office map"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-010', 'Conversation 4 — Hotel booking
Man: The hotel confirmed our rooms, but breakfast isn’t included in the rate.
Woman: We’ll be there for three mornings. Is it cheaper to add breakfast now?
Man: Yes, the front desk offered a discounted package if we decide before check-in.
Woman: Please add it. We have an early conference each day.
Question 1: What are the speakers planning?', '{"A":"A company dinner","B":"A business trip","C":"A hotel renovation","D":"A conference presentation"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-011', 'Conversation 4 — Hotel booking
Man: The hotel confirmed our rooms, but breakfast isn’t included in the rate.
Woman: We’ll be there for three mornings. Is it cheaper to add breakfast now?
Man: Yes, the front desk offered a discounted package if we decide before check-in.
Woman: Please add it. We have an early conference each day.
Question 2: What does the man say about breakfast?', '{"A":"It is included for all guests","B":"It is available only after 9 a.m.","C":"It can be added at a discount","D":"It must be paid for in cash"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-012', 'Conversation 4 — Hotel booking
Man: The hotel confirmed our rooms, but breakfast isn’t included in the rate.
Woman: We’ll be there for three mornings. Is it cheaper to add breakfast now?
Man: Yes, the front desk offered a discounted package if we decide before check-in.
Woman: Please add it. We have an early conference each day.
Question 3: Why does the woman want breakfast?', '{"A":"They have early starts","B":"The hotel restaurant is closed","C":"Their rooms have no kitchen","D":"The conference provides no lunch"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-013', 'Conversation 5 — Software training
Woman: I opened the new inventory system, but I can’t find the monthly report function.
Man: It moved under Analytics in the latest update. I’ll show you after the team briefing.
Woman: Thanks. I need to prepare the figures for Thursday’s review.
Man: I’ll send you the updated user guide, too.
Question 1: What difficulty does the woman have?', '{"A":"She cannot log in to her account","B":"She cannot locate a feature","C":"She lost a monthly report","D":"She forgot the team briefing"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-014', 'Conversation 5 — Software training
Woman: I opened the new inventory system, but I can’t find the monthly report function.
Man: It moved under Analytics in the latest update. I’ll show you after the team briefing.
Woman: Thanks. I need to prepare the figures for Thursday’s review.
Man: I’ll send you the updated user guide, too.
Question 2: Where is the report function now?', '{"A":"Under Analytics","B":"In Account Settings","C":"On the home page","D":"Inside the Help Desk"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-015', 'Conversation 5 — Software training
Woman: I opened the new inventory system, but I can’t find the monthly report function.
Man: It moved under Analytics in the latest update. I’ll show you after the team briefing.
Woman: Thanks. I need to prepare the figures for Thursday’s review.
Man: I’ll send you the updated user guide, too.
Question 3: What will the man send?', '{"A":"A meeting invitation","B":"A list of inventory items","C":"An updated guide","D":"A revised budget"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-016', 'Conversation 6 — Restaurant reservation
Man: I booked a table for eight at 7 p.m., but two more colleagues are joining us.
Woman: The restaurant can seat ten, but they need at least a day’s notice for the larger table.
Man: The dinner is tomorrow. I’ll call them now and see if they can accommodate us.
Woman: If not, there’s another restaurant across the street.
Question 1: What change is needed?', '{"A":"The dinner date","B":"The reservation size","C":"The menu selection","D":"The payment method"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-017', 'Conversation 6 — Restaurant reservation
Man: I booked a table for eight at 7 p.m., but two more colleagues are joining us.
Woman: The restaurant can seat ten, but they need at least a day’s notice for the larger table.
Man: The dinner is tomorrow. I’ll call them now and see if they can accommodate us.
Woman: If not, there’s another restaurant across the street.
Question 2: What does the woman say the restaurant requires?', '{"A":"A deposit for every guest","B":"A printed invitation","C":"Advance notice for a larger table","D":"A minimum order per person"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-018', 'Conversation 6 — Restaurant reservation
Man: I booked a table for eight at 7 p.m., but two more colleagues are joining us.
Woman: The restaurant can seat ten, but they need at least a day’s notice for the larger table.
Man: The dinner is tomorrow. I’ll call them now and see if they can accommodate us.
Woman: If not, there’s another restaurant across the street.
Question 3: What might the speakers do if necessary?', '{"A":"Choose another restaurant","B":"Move the dinner to next week","C":"Invite fewer colleagues","D":"Eat at the office"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-019', 'Conversation 7 — Marketing campaign
Woman: The online campaign is getting plenty of views, but very few people are clicking the registration link.
Man: The landing page may be too complicated. I can ask the design team to simplify the form.
Woman: Good. Let’s also test a shorter headline before we increase the advertising budget.
Man: I’ll prepare two versions for comparison.
Question 1: What concerns the woman?', '{"A":"The campaign has exceeded its budget","B":"The website is receiving few visits","C":"Few viewers are registering","D":"The design team missed a deadline"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-020', 'Conversation 7 — Marketing campaign
Woman: The online campaign is getting plenty of views, but very few people are clicking the registration link.
Man: The landing page may be too complicated. I can ask the design team to simplify the form.
Woman: Good. Let’s also test a shorter headline before we increase the advertising budget.
Man: I’ll prepare two versions for comparison.
Question 2: What does the man offer to do?', '{"A":"Simplify the registration form","B":"Hire another designer","C":"Increase the advertising budget","D":"Write a customer newsletter"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-021', 'Conversation 7 — Marketing campaign
Woman: The online campaign is getting plenty of views, but very few people are clicking the registration link.
Man: The landing page may be too complicated. I can ask the design team to simplify the form.
Woman: Good. Let’s also test a shorter headline before we increase the advertising budget.
Man: I’ll prepare two versions for comparison.
Question 3: What will the man prepare?', '{"A":"A sales forecast","B":"Two headline versions","C":"A new product sample","D":"A staff schedule"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-022', 'Conversation 8 — Office supplies
Man: We’re almost out of printer paper, and the supplier’s usual delivery is taking a week.
Woman: There’s a local office store that can deliver tomorrow, although the price is slightly higher.
Man: Let’s place a small order there for now and use our regular supplier for the monthly stock.
Woman: I’ll submit the urgent purchase request this afternoon.
Question 1: What issue do the speakers discuss?', '{"A":"A printer that needs repair","B":"A shortage of office supplies","C":"An incorrect supplier invoice","D":"A change in office location"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-023', 'Conversation 8 — Office supplies
Man: We’re almost out of printer paper, and the supplier’s usual delivery is taking a week.
Woman: There’s a local office store that can deliver tomorrow, although the price is slightly higher.
Man: Let’s place a small order there for now and use our regular supplier for the monthly stock.
Woman: I’ll submit the urgent purchase request this afternoon.
Question 2: Why consider the local store?', '{"A":"It offers free installation","B":"It has a wider selection","C":"It can deliver sooner","D":"It has longer payment terms"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-024', 'Conversation 8 — Office supplies
Man: We’re almost out of printer paper, and the supplier’s usual delivery is taking a week.
Woman: There’s a local office store that can deliver tomorrow, although the price is slightly higher.
Man: Let’s place a small order there for now and use our regular supplier for the monthly stock.
Woman: I’ll submit the urgent purchase request this afternoon.
Question 3: What will the woman do?', '{"A":"Submit a purchase request","B":"Contact the printer manufacturer","C":"Cancel the monthly order","D":"Count the warehouse stock"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-025', 'Conversation 9 — Job candidate
Woman: I’ve reviewed the applications for the analyst position. One candidate has strong technical skills but limited client experience.
Man: The role requires frequent presentations, so communication is important.
Woman: Agreed. Let’s invite her for a second interview and ask her to present a short case study.
Man: I’ll coordinate with the hiring panel.
Question 1: What are the speakers reviewing?', '{"A":"Customer complaints","B":"Applications for a job","C":"Quarterly sales results","D":"Training materials"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-026', 'Conversation 9 — Job candidate
Woman: I’ve reviewed the applications for the analyst position. One candidate has strong technical skills but limited client experience.
Man: The role requires frequent presentations, so communication is important.
Woman: Agreed. Let’s invite her for a second interview and ask her to present a short case study.
Man: I’ll coordinate with the hiring panel.
Question 2: What concern does the man mention?', '{"A":"The candidate lives too far away","B":"The salary is too low","C":"Communication is important for the role","D":"The position is temporary"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-027', 'Conversation 9 — Job candidate
Woman: I’ve reviewed the applications for the analyst position. One candidate has strong technical skills but limited client experience.
Man: The role requires frequent presentations, so communication is important.
Woman: Agreed. Let’s invite her for a second interview and ask her to present a short case study.
Man: I’ll coordinate with the hiring panel.
Question 3: What will the man do?', '{"A":"Arrange the interview panel","B":"Write the case study","C":"Contact a former employer","D":"Revise the job description"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-028', 'Conversation 10 — Building maintenance
Man: The elevator near the west entrance will be serviced tomorrow morning.
Woman: That’s the one visitors usually use from the parking garage. We should put up signs at both entrances.
Man: I’ll ask security to direct visitors to the central elevator.
Woman: I’ll notify the departments that have scheduled interviews.
Question 1: What will happen tomorrow?', '{"A":"The parking garage will close","B":"An elevator will be serviced","C":"The west entrance will be renovated","D":"Security staff will receive training"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-029', 'Conversation 10 — Building maintenance
Man: The elevator near the west entrance will be serviced tomorrow morning.
Woman: That’s the one visitors usually use from the parking garage. We should put up signs at both entrances.
Man: I’ll ask security to direct visitors to the central elevator.
Woman: I’ll notify the departments that have scheduled interviews.
Question 2: What does the woman suggest?', '{"A":"Canceling all interviews","B":"Moving the parking garage","C":"Putting up signs","D":"Hiring another security guard"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-030', 'Conversation 10 — Building maintenance
Man: The elevator near the west entrance will be serviced tomorrow morning.
Woman: That’s the one visitors usually use from the parking garage. We should put up signs at both entrances.
Man: I’ll ask security to direct visitors to the central elevator.
Woman: I’ll notify the departments that have scheduled interviews.
Question 3: Who will the woman contact?', '{"A":"Departments with interviews scheduled","B":"The elevator repair company","C":"The building owner","D":"All delivery drivers"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-031', 'Conversation 11 — Conference materials
Woman: The brochures arrived, but the event date on the back cover is incorrect.
Man: That’s unfortunate. Can we print correction labels before registration opens?
Woman: Yes, the print shop can deliver them by noon. We’ll need volunteers to apply them.
Man: I’ll ask the event team to help during lunch.
Question 1: What is wrong with the brochures?', '{"A":"The paper is too thin","B":"The event date is incorrect","C":"The map is missing","D":"The colors are faded"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-032', 'Conversation 11 — Conference materials
Woman: The brochures arrived, but the event date on the back cover is incorrect.
Man: That’s unfortunate. Can we print correction labels before registration opens?
Woman: Yes, the print shop can deliver them by noon. We’ll need volunteers to apply them.
Man: I’ll ask the event team to help during lunch.
Question 2: What can the print shop provide?', '{"A":"Replacement tables","B":"A new event venue","C":"Correction labels","D":"Registration badges"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-033', 'Conversation 11 — Conference materials
Woman: The brochures arrived, but the event date on the back cover is incorrect.
Man: That’s unfortunate. Can we print correction labels before registration opens?
Woman: Yes, the print shop can deliver them by noon. We’ll need volunteers to apply them.
Man: I’ll ask the event team to help during lunch.
Question 3: What will the man do?', '{"A":"Ask volunteers to help","B":"Cancel registration","C":"Rewrite the brochure","D":"Contact the speakers"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-034', 'Conversation 12 — Project deadline
Man: The client has asked us to deliver the prototype a week earlier than planned.
Woman: We can finish the design by Friday, but testing normally takes four days.
Man: Could we have the quality team test the core functions first and check the rest next week?
Woman: I’ll discuss that approach with the project lead before we promise anything.
Question 1: What change has the client requested?', '{"A":"A lower price","B":"An earlier delivery","C":"Additional features","D":"A longer warranty"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-035', 'Conversation 12 — Project deadline
Man: The client has asked us to deliver the prototype a week earlier than planned.
Woman: We can finish the design by Friday, but testing normally takes four days.
Man: Could we have the quality team test the core functions first and check the rest next week?
Woman: I’ll discuss that approach with the project lead before we promise anything.
Question 2: What does the woman say takes four days?', '{"A":"Designing the prototype","B":"Preparing the presentation","C":"Testing the product","D":"Training the client"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-036', 'Conversation 12 — Project deadline
Man: The client has asked us to deliver the prototype a week earlier than planned.
Woman: We can finish the design by Friday, but testing normally takes four days.
Man: Could we have the quality team test the core functions first and check the rest next week?
Woman: I’ll discuss that approach with the project lead before we promise anything.
Question 3: What will the woman do next?', '{"A":"Discuss the proposal with the project lead","B":"Send the prototype to the client","C":"Hire temporary testers","D":"Change the product specifications"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-037', 'Conversation 13 — Travel reimbursement
Woman: My reimbursement claim was returned because the hotel receipt wasn’t itemized.
Man: The hotel can email a detailed copy. I had to request one after my last trip.
Woman: I’ll contact them today. The finance department processes claims on Friday, so I hope to submit it in time.
Man: Send me the copy if you need help uploading it.
Question 1: Why was the claim returned?', '{"A":"It exceeded the travel budget","B":"A receipt lacked details","C":"The form was submitted late","D":"The trip was not approved"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-038', 'Conversation 13 — Travel reimbursement
Woman: My reimbursement claim was returned because the hotel receipt wasn’t itemized.
Man: The hotel can email a detailed copy. I had to request one after my last trip.
Woman: I’ll contact them today. The finance department processes claims on Friday, so I hope to submit it in time.
Man: Send me the copy if you need help uploading it.
Question 2: What does the man suggest?', '{"A":"Requesting a detailed receipt","B":"Paying the hotel again","C":"Changing the travel dates","D":"Contacting the client"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 3, '16-3-039', 'Conversation 13 — Travel reimbursement
Woman: My reimbursement claim was returned because the hotel receipt wasn’t itemized.
Man: The hotel can email a detailed copy. I had to request one after my last trip.
Woman: I’ll contact them today. The finance department processes claims on Friday, so I hope to submit it in time.
Man: Send me the copy if you need help uploading it.
Question 3: When does finance process claims?', '{"A":"Every Monday","B":"At the end of each month","C":"On Friday","D":"Only during business trips"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-001', 'Talk 1 — Flight announcement
Good afternoon, passengers on Flight 618 to Vancouver. Boarding has been delayed by approximately twenty minutes because the incoming aircraft arrived late. Please remain near Gate 12 and listen for further announcements. Passengers requiring assistance may speak with the gate agent.
Question 1: What is being announced?', '{"A":"A gate change","B":"A boarding delay","C":"A canceled flight","D":"A baggage claim procedure"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-002', 'Talk 1 — Flight announcement
Good afternoon, passengers on Flight 618 to Vancouver. Boarding has been delayed by approximately twenty minutes because the incoming aircraft arrived late. Please remain near Gate 12 and listen for further announcements. Passengers requiring assistance may speak with the gate agent.
Question 2: What should passengers do?', '{"A":"Wait near Gate 12","B":"Proceed to customs","C":"Board a shuttle bus","D":"Collect their luggage"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-003', 'Talk 1 — Flight announcement
Good afternoon, passengers on Flight 618 to Vancouver. Boarding has been delayed by approximately twenty minutes because the incoming aircraft arrived late. Please remain near Gate 12 and listen for further announcements. Passengers requiring assistance may speak with the gate agent.
Question 3: Who can provide assistance?', '{"A":"The flight crew in the air","B":"The hotel receptionist","C":"The gate agent","D":"The baggage handler"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-004', 'Talk 2 — Store promotion
This weekend, Greenway Home is offering twenty percent off selected kitchen appliances. The promotion begins Saturday morning and continues through closing time on Sunday. Customers who spend more than two hundred dollars can also receive free delivery. Visit the service counter for details about eligible products.
Question 1: What is the announcement about?', '{"A":"A store renovation","B":"A weekend discount","C":"A new store opening","D":"A cooking demonstration"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-005', 'Talk 2 — Store promotion
This weekend, Greenway Home is offering twenty percent off selected kitchen appliances. The promotion begins Saturday morning and continues through closing time on Sunday. Customers who spend more than two hundred dollars can also receive free delivery. Visit the service counter for details about eligible products.
Question 2: When does the promotion end?', '{"A":"Friday evening","B":"Saturday morning","C":"Sunday at closing time","D":"Monday at noon"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-006', 'Talk 2 — Store promotion
This weekend, Greenway Home is offering twenty percent off selected kitchen appliances. The promotion begins Saturday morning and continues through closing time on Sunday. Customers who spend more than two hundred dollars can also receive free delivery. Visit the service counter for details about eligible products.
Question 3: What can some customers receive?', '{"A":"Free delivery","B":"A gift card for every purchase","C":"A free appliance","D":"Extended store hours"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-007', 'Talk 3 — Museum tour
Welcome to the City History Museum. Our guided tour will begin in the main hall in five minutes. Photography is permitted in the permanent exhibition, but please do not use flash in the gallery of historic documents. After the tour, visitors may join a short workshop on preserving family photographs in Room 204.
Question 1: Where are the listeners?', '{"A":"At a public library","B":"At a museum","C":"At a photography studio","D":"At a university auditorium"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-008', 'Talk 3 — Museum tour
Welcome to the City History Museum. Our guided tour will begin in the main hall in five minutes. Photography is permitted in the permanent exhibition, but please do not use flash in the gallery of historic documents. After the tour, visitors may join a short workshop on preserving family photographs in Room 204.
Question 2: What restriction is mentioned?', '{"A":"Food is prohibited in the lobby","B":"Visitors must leave bags outside","C":"Flash photography is not allowed in one gallery","D":"The permanent exhibition is closed"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-009', 'Talk 3 — Museum tour
Welcome to the City History Museum. Our guided tour will begin in the main hall in five minutes. Photography is permitted in the permanent exhibition, but please do not use flash in the gallery of historic documents. After the tour, visitors may join a short workshop on preserving family photographs in Room 204.
Question 3: What can visitors do after the tour?', '{"A":"Attend a workshop","B":"Meet the museum director","C":"Buy historic documents","D":"Watch a film outdoors"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-010', 'Talk 4 — Company voicemail
Hello, this is Nina from the purchasing department. The replacement monitors have arrived, but the delivery team left them in the storage area rather than distributing them to individual offices. Please ask your department coordinator to confirm the number of monitors needed by 3 p.m. today. We’ll arrange delivery tomorrow morning.
Question 1: Why is Nina calling?', '{"A":"To announce a purchasing policy","B":"To report a late meeting","C":"To explain a monitor delivery","D":"To request travel receipts"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-011', 'Talk 4 — Company voicemail
Hello, this is Nina from the purchasing department. The replacement monitors have arrived, but the delivery team left them in the storage area rather than distributing them to individual offices. Please ask your department coordinator to confirm the number of monitors needed by 3 p.m. today. We’ll arrange delivery tomorrow morning.
Question 2: What must department coordinators do?', '{"A":"Install the monitors","B":"Confirm the quantity needed","C":"Return old computers","D":"Contact the delivery company"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-012', 'Talk 4 — Company voicemail
Hello, this is Nina from the purchasing department. The replacement monitors have arrived, but the delivery team left them in the storage area rather than distributing them to individual offices. Please ask your department coordinator to confirm the number of monitors needed by 3 p.m. today. We’ll arrange delivery tomorrow morning.
Question 3: When will the monitors be distributed?', '{"A":"This afternoon","B":"Tomorrow morning","C":"Next Monday","D":"At the end of the month"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-013', 'Talk 5 — Weather update
The regional weather service expects heavy rain across the coastal area this evening, with stronger winds after 9 p.m. Ferry operators have advised passengers to check departure notices before leaving home. The rain should ease by tomorrow morning, although some roads near the harbor may remain flooded.
Question 1: What is the report mainly about?', '{"A":"A ferry fare increase","B":"A coastal weather forecast","C":"A road construction project","D":"A harbor festival"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-014', 'Talk 5 — Weather update
The regional weather service expects heavy rain across the coastal area this evening, with stronger winds after 9 p.m. Ferry operators have advised passengers to check departure notices before leaving home. The rain should ease by tomorrow morning, although some roads near the harbor may remain flooded.
Question 2: What are ferry passengers advised to do?', '{"A":"Arrive a day early","B":"Use the train instead","C":"Check departure notices","D":"Bring identification photographs"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-015', 'Talk 5 — Weather update
The regional weather service expects heavy rain across the coastal area this evening, with stronger winds after 9 p.m. Ferry operators have advised passengers to check departure notices before leaving home. The rain should ease by tomorrow morning, although some roads near the harbor may remain flooded.
Question 3: What may still be affected tomorrow?', '{"A":"Roads near the harbor","B":"Flights to the north","C":"The city water supply","D":"Museum opening hours"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-016', 'Talk 6 — Training seminar
Thank you for registering for our leadership seminar. The morning session will cover setting team goals, and the afternoon session will focus on resolving workplace conflicts. Printed materials are available at the registration desk. If you requested a vegetarian lunch, please collect a green meal ticket before entering the dining room.
Question 1: What event is taking place?', '{"A":"A leadership seminar","B":"A product launch","C":"A job fair","D":"A sales exhibition"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-017', 'Talk 6 — Training seminar
Thank you for registering for our leadership seminar. The morning session will cover setting team goals, and the afternoon session will focus on resolving workplace conflicts. Printed materials are available at the registration desk. If you requested a vegetarian lunch, please collect a green meal ticket before entering the dining room.
Question 2: Where can attendees get printed materials?', '{"A":"In the dining room","B":"At the registration desk","C":"Outside the parking garage","D":"In the speaker’s office"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-018', 'Talk 6 — Training seminar
Thank you for registering for our leadership seminar. The morning session will cover setting team goals, and the afternoon session will focus on resolving workplace conflicts. Printed materials are available at the registration desk. If you requested a vegetarian lunch, please collect a green meal ticket before entering the dining room.
Question 3: Who should collect a green ticket?', '{"A":"All seminar speakers","B":"Attendees leaving early","C":"People requesting vegetarian lunch","D":"Visitors without registration"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-019', 'Talk 7 — Real estate message
Thank you for contacting Northside Properties about the two-bedroom apartment on Willow Street. The current tenant will move out at the end of the month, and the apartment can be viewed starting next Tuesday. Please bring a photo identification document to the viewing. Applications received by Friday will be considered first.
Question 1: What is the message about?', '{"A":"A property viewing","B":"A mortgage payment","C":"A neighborhood meeting","D":"A building repair"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-020', 'Talk 7 — Real estate message
Thank you for contacting Northside Properties about the two-bedroom apartment on Willow Street. The current tenant will move out at the end of the month, and the apartment can be viewed starting next Tuesday. Please bring a photo identification document to the viewing. Applications received by Friday will be considered first.
Question 2: When can the apartment be viewed?', '{"A":"Today","B":"At the end of the month","C":"Starting next Tuesday","D":"Only on Friday"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-021', 'Talk 7 — Real estate message
Thank you for contacting Northside Properties about the two-bedroom apartment on Willow Street. The current tenant will move out at the end of the month, and the apartment can be viewed starting next Tuesday. Please bring a photo identification document to the viewing. Applications received by Friday will be considered first.
Question 3: What should visitors bring?', '{"A":"A utility bill","B":"Photo identification","C":"A rental deposit in cash","D":"A reference letter"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-022', 'Talk 8 — Library notice
The central library will close at 6 p.m. this Thursday for scheduled electrical maintenance. Items due on Thursday may be returned through the outdoor book drop, and no late fees will be charged for those items. The reading room will reopen at its regular time on Friday morning.
Question 1: Why will the library close early?', '{"A":"A staff meeting","B":"Electrical maintenance","C":"A public lecture","D":"A book inventory"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-023', 'Talk 8 — Library notice
The central library will close at 6 p.m. this Thursday for scheduled electrical maintenance. Items due on Thursday may be returned through the outdoor book drop, and no late fees will be charged for those items. The reading room will reopen at its regular time on Friday morning.
Question 2: How can patrons return books?', '{"A":"Through the outdoor book drop","B":"At the city hall","C":"By mailing them to the publisher","D":"At the reading room entrance only"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-024', 'Talk 8 — Library notice
The central library will close at 6 p.m. this Thursday for scheduled electrical maintenance. Items due on Thursday may be returned through the outdoor book drop, and no late fees will be charged for those items. The reading room will reopen at its regular time on Friday morning.
Question 3: What is true about late fees?', '{"A":"They will double","B":"They apply as usual","C":"They will be waived for items due Thursday","D":"They are paid at the reading room"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-025', 'Talk 9 — Product webinar
Today’s webinar demonstrates the latest features of our scheduling platform. We’ll begin with calendar sharing, then show how managers can generate weekly staffing reports. The session is being recorded, and registered participants will receive a link tomorrow. Please type questions into the Q&A panel rather than the chat window.
Question 1: What is the webinar about?', '{"A":"A scheduling platform","B":"A new accounting law","C":"A recruitment campaign","D":"A customer survey"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-026', 'Talk 9 — Product webinar
Today’s webinar demonstrates the latest features of our scheduling platform. We’ll begin with calendar sharing, then show how managers can generate weekly staffing reports. The session is being recorded, and registered participants will receive a link tomorrow. Please type questions into the Q&A panel rather than the chat window.
Question 2: What will managers learn to generate?', '{"A":"Invoices","B":"Weekly staffing reports","C":"Product advertisements","D":"Travel itineraries"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-027', 'Talk 9 — Product webinar
Today’s webinar demonstrates the latest features of our scheduling platform. We’ll begin with calendar sharing, then show how managers can generate weekly staffing reports. The session is being recorded, and registered participants will receive a link tomorrow. Please type questions into the Q&A panel rather than the chat window.
Question 3: How will participants receive the recording?', '{"A":"On a USB drive today","B":"Through a link tomorrow","C":"By postal mail next week","D":"From the chat window"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-028', 'Talk 10 — Charity run
The annual Riverside Charity Run takes place this Sunday. Participants should collect their race numbers from the tent beside the north entrance between 7 and 8 a.m. The five-kilometer route begins at 8:30, followed by the ten-kilometer race at 9. Water stations will be located at every kilometer marker.
Question 1: What event is being advertised?', '{"A":"A river cleanup","B":"A charity run","C":"A cycling competition","D":"A food festival"}'::jsonb, 'B', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-029', 'Talk 10 — Charity run
The annual Riverside Charity Run takes place this Sunday. Participants should collect their race numbers from the tent beside the north entrance between 7 and 8 a.m. The five-kilometer route begins at 8:30, followed by the ten-kilometer race at 9. Water stations will be located at every kilometer marker.
Question 2: Where should participants collect race numbers?', '{"A":"At the north entrance tent","B":"Inside the sports center","C":"At the finish line","D":"Near the parking exit"}'::jsonb, 'A', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z'),
(16, 4, '16-4-030', 'Talk 10 — Charity run
The annual Riverside Charity Run takes place this Sunday. Participants should collect their race numbers from the tent beside the north entrance between 7 and 8 a.m. The five-kilometer route begins at 8:30, followed by the ten-kilometer race at 9. Water stations will be located at every kilometer marker.
Question 3: What is mentioned about the route?', '{"A":"It includes a bridge closure","B":"It starts at 9 a.m.","C":"Water stations are placed along it","D":"All races begin together"}'::jsonb, 'C', '{"type":"none"}'::jsonb, '原创 TOEIC 风格练习；目前未附音频。听力原文/场景信息见题干。', 'unanswered', '2026-10-29T12:00:00Z', '2026-10-29T12:00:00Z')
on conflict (set_id, question_id) do update set part_id=excluded.part_id, title=excluded.title, options=excluded.options, correct_answer=excluded.correct_answer, audio=excluded.audio, note=excluded.note, status='unanswered', updated_at=excluded.updated_at;

-- Verify import count and distribution before commit.
do $$ declare n integer; begin
  select count(*) into n from public.toeic_questions where set_id=16;
  if n <> 100 then raise exception 'Expected 100 questions in set 16, found %', n; end if;
end $$;
commit;

select set_id, part_id, count(*) as question_count
from public.toeic_questions where set_id=16
group by set_id, part_id order by part_id;
