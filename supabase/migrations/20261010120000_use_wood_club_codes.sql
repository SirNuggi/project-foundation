BEGIN;

UPDATE public.user_clubs
SET club_code = 'W' || substring(club_code FROM 2)
WHERE category = 'woods'
  AND is_custom = false
  AND club_code IN ('H3', 'H5', 'H7');

-- Snapshot-Namen unterscheiden Hölzer eindeutig von Hybrids und eigenen Schlägern.
UPDATE public.shot_logs
SET club_code = 'W' || substring(club_code FROM 2)
WHERE (club_code = 'H3' AND club_name = 'Holz 3')
   OR (club_code = 'H5' AND club_name = 'Holz 5')
   OR (club_code = 'H7' AND club_name = 'Holz 7');

CREATE OR REPLACE FUNCTION public.initialize_profile_golf_bag() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_clubs (user_id, club_code, club_name, category)
  SELECT NEW.id, code, name, category FROM (VALUES
    ('D', 'Driver', 'woods'), ('W3', 'Holz 3', 'woods'),
    ('I5', 'Eisen 5', 'irons'), ('I6', 'Eisen 6', 'irons'),
    ('I7', 'Eisen 7', 'irons'), ('I8', 'Eisen 8', 'irons'), ('I9', 'Eisen 9', 'irons'),
    ('PW', 'Pitching Wedge', 'wedges'), ('SW', 'Sand Wedge', 'wedges'), ('P', 'Putter', 'putter')
  ) AS defaults(code, name, category);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_profile_golf_bag() FROM PUBLIC;

COMMIT;
