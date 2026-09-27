CREATE TABLE public.tee_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  slope integer NOT NULL DEFAULT 113,
  course_rating numeric(4,1) NOT NULL DEFAULT 70.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tee_boxes_course_id_idx ON public.tee_boxes(course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tee_boxes TO authenticated;
GRANT ALL ON public.tee_boxes TO service_role;

ALTER TABLE public.tee_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tee boxes readable" ON public.tee_boxes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Course owner or admin insert tee boxes" ON public.tee_boxes
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = tee_boxes.course_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Course owner or admin update tee boxes" ON public.tee_boxes
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = tee_boxes.course_id AND c.created_by = auth.uid()
    )
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = tee_boxes.course_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Course owner or admin delete tee boxes" ON public.tee_boxes
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = tee_boxes.course_id AND c.created_by = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_tee_box_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.tee_boxes WHERE course_id = NEW.course_id) >= 6 THEN
    RAISE EXCEPTION 'Maximal 6 Abschläge pro Golfplatz';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tee_boxes_limit
BEFORE INSERT ON public.tee_boxes
FOR EACH ROW EXECUTE FUNCTION public.enforce_tee_box_limit();

INSERT INTO public.tee_boxes (course_id, name, slope, course_rating)
SELECT c.id, 'Gelb', COALESCE(c.slope_herren, 103), COALESCE(c.cr_herren, 63.1) FROM public.courses c;

INSERT INTO public.tee_boxes (course_id, name, slope, course_rating)
SELECT c.id, 'Rot', COALESCE(c.slope_damen, 103), COALESCE(c.cr_damen, 63.9) FROM public.courses c;

ALTER TABLE public.round_players ADD COLUMN tee_box_id uuid REFERENCES public.tee_boxes(id) ON DELETE SET NULL;

UPDATE public.round_players SET tee = CASE WHEN tee = 'damen' THEN 'Rot' WHEN tee = 'herren' THEN 'Gelb' ELSE tee END;

ALTER TABLE public.profiles ALTER COLUMN default_tee DROP DEFAULT;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%default_tee%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
UPDATE public.profiles SET default_tee = CASE WHEN default_tee = 'damen' THEN 'Rot' WHEN default_tee = 'herren' THEN 'Gelb' ELSE default_tee END;
ALTER TABLE public.profiles ALTER COLUMN default_tee SET DEFAULT 'Gelb';

ALTER TABLE public.courses DROP COLUMN slope_herren;
ALTER TABLE public.courses DROP COLUMN cr_herren;
ALTER TABLE public.courses DROP COLUMN slope_damen;
ALTER TABLE public.courses DROP COLUMN cr_damen;