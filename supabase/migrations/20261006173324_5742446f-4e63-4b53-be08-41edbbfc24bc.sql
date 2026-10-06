CREATE OR REPLACE FUNCTION public.enforce_tee_box_limit()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT count(*) FROM public.tee_boxes WHERE course_id = NEW.course_id) >= 10 THEN
    RAISE EXCEPTION 'Maximal 10 Abschläge pro Golfplatz';
  END IF;
  RETURN NEW;
END;
$function$;