DROP POLICY "Participants read rounds" ON public.rounds;
CREATE POLICY "Participants read rounds" ON public.rounds FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_round_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "Participants update rounds" ON public.rounds;
CREATE POLICY "Participants update rounds" ON public.rounds FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_round_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.is_round_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DELETE FROM public.friendships WHERE user_id = friend_id;
DELETE FROM public.rounds WHERE course_name IN ('Test', 'Test2', 'Test3');