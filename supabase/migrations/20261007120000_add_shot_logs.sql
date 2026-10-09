CREATE TABLE public.shot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hole_number integer NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  shot_number integer NOT NULL CHECK (shot_number > 0),
  club_code text NOT NULL CHECK (club_code IN ('driver', 'wood3', 'hybrid', 'i5', 'i7', 'i9', 'pw', 'sw', 'putter')),
  latitude numeric(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  distance_meters numeric(6, 1) CHECK (distance_meters >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id, hole_number, shot_number)
);

ALTER TABLE public.shot_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shot_logs TO authenticated;
GRANT ALL ON public.shot_logs TO service_role;

CREATE POLICY "Participants read shot logs" ON public.shot_logs
FOR SELECT TO authenticated
USING (
  public.is_round_participant(round_id, auth.uid())
  OR public.can_read_round_via_group(round_id, auth.uid())
);

CREATE POLICY "Players insert own shot logs" ON public.shot_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_round_participant(round_id, auth.uid()));

CREATE POLICY "Players update own shot logs" ON public.shot_logs
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.is_round_participant(round_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.is_round_participant(round_id, auth.uid()));

CREATE POLICY "Players delete own shot logs" ON public.shot_logs
FOR DELETE TO authenticated
USING (user_id = auth.uid());
