ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handicap_index numeric(4,1) NOT NULL DEFAULT -54.0,
  ADD COLUMN IF NOT EXISTS default_tee text NOT NULL DEFAULT 'herren';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_default_tee_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_default_tee_check CHECK (default_tee IN ('herren','damen'));

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS slope_herren integer NOT NULL DEFAULT 103,
  ADD COLUMN IF NOT EXISTS cr_herren numeric(4,1) NOT NULL DEFAULT 63.1,
  ADD COLUMN IF NOT EXISTS slope_damen integer NOT NULL DEFAULT 103,
  ADD COLUMN IF NOT EXISTS cr_damen numeric(4,1) NOT NULL DEFAULT 63.9;

ALTER TABLE public.round_players
  ADD COLUMN IF NOT EXISTS handicap_index numeric(4,1),
  ADD COLUMN IF NOT EXISTS tee text,
  ADD COLUMN IF NOT EXISTS course_handicap integer;

DROP POLICY IF EXISTS "Users create courses" ON public.courses;
CREATE POLICY "Users create courses" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Creators create course holes" ON public.course_holes;
CREATE POLICY "Creators create course holes" ON public.course_holes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_id AND c.created_by = auth.uid()
  ));