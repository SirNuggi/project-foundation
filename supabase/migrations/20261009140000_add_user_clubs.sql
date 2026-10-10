CREATE TABLE public.user_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_code varchar(2) NOT NULL CHECK (char_length(club_code) BETWEEN 1 AND 2),
  club_name text NOT NULL CHECK (char_length(trim(club_name)) BETWEEN 1 AND 80),
  category text NOT NULL CHECK (category IN ('woods', 'hybrids', 'irons', 'wedges', 'putter', 'custom')),
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, club_code)
);
ALTER TABLE public.user_clubs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.user_clubs TO authenticated;
GRANT ALL ON public.user_clubs TO service_role;
CREATE POLICY "Users read own clubs" ON public.user_clubs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own clubs" ON public.user_clubs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own clubs" ON public.user_clubs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Initialisierung nur bei Profilanlage / Migration, niemals bei einem absichtlich leeren Bag.
CREATE FUNCTION public.initialize_profile_golf_bag() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_clubs (user_id, club_code, club_name, category)
  SELECT NEW.id, code, name, category FROM (VALUES
    ('D', 'Driver', 'woods'), ('H3', 'Holz 3', 'woods'),
    ('I5', 'Eisen 5', 'irons'), ('I6', 'Eisen 6', 'irons'),
    ('I7', 'Eisen 7', 'irons'), ('I8', 'Eisen 8', 'irons'), ('I9', 'Eisen 9', 'irons'),
    ('PW', 'Pitching Wedge', 'wedges'), ('SW', 'Sand Wedge', 'wedges'), ('P', 'Putter', 'putter')
  ) AS defaults(code, name, category);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_profile_golf_bag() FROM PUBLIC;
CREATE TRIGGER profiles_initialize_golf_bag AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_profile_golf_bag();

INSERT INTO public.user_clubs (user_id, club_code, club_name, category)
SELECT p.id, d.code, d.name, d.category FROM public.profiles p CROSS JOIN (VALUES
  ('D', 'Driver', 'woods'), ('H3', 'Holz 3', 'woods'),
  ('I5', 'Eisen 5', 'irons'), ('I6', 'Eisen 6', 'irons'),
  ('I7', 'Eisen 7', 'irons'), ('I8', 'Eisen 8', 'irons'), ('I9', 'Eisen 9', 'irons'),
  ('PW', 'Pitching Wedge', 'wedges'), ('SW', 'Sand Wedge', 'wedges'), ('P', 'Putter', 'putter')
) AS d(code, name, category);

-- Schlägerbezeichnung als Snapshot: alte Schläge bleiben nach Bag-Änderungen lesbar.
ALTER TABLE public.shot_logs DROP CONSTRAINT shot_logs_club_code_check;
ALTER TABLE public.shot_logs ADD COLUMN club_name text;
UPDATE public.shot_logs SET
  club_name = CASE club_code
    WHEN 'driver' THEN 'Driver' WHEN 'wood3' THEN 'Holz 3' WHEN 'hybrid' THEN 'Hybrid'
    WHEN 'i5' THEN 'Eisen 5' WHEN 'i7' THEN 'Eisen 7' WHEN 'i9' THEN 'Eisen 9'
    WHEN 'pw' THEN 'Pitching Wedge' WHEN 'sw' THEN 'Sand Wedge' WHEN 'putter' THEN 'Putter'
    ELSE club_code END,
  club_code = CASE club_code
    WHEN 'driver' THEN 'D' WHEN 'wood3' THEN 'H3' WHEN 'hybrid' THEN 'H'
    WHEN 'putter' THEN 'P' ELSE upper(club_code) END;
ALTER TABLE public.shot_logs ADD CONSTRAINT shot_logs_club_code_check CHECK (char_length(club_code) BETWEEN 1 AND 2);
