ALTER TABLE public.penalties ADD COLUMN IF NOT EXISTS penalty_date date;
UPDATE public.penalties p SET penalty_date = r.played_on FROM public.rounds r WHERE r.id = p.round_id AND p.penalty_date IS NULL;
CREATE INDEX IF NOT EXISTS penalties_penalty_date_idx ON public.penalties(penalty_date);
CREATE OR REPLACE FUNCTION public.set_penalty_date()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.penalty_date IS NULL THEN
    SELECT played_on INTO NEW.penalty_date FROM public.rounds WHERE id = NEW.round_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS penalties_set_date ON public.penalties;
CREATE TRIGGER penalties_set_date BEFORE INSERT ON public.penalties FOR EACH ROW EXECUTE FUNCTION public.set_penalty_date();
CREATE OR REPLACE FUNCTION public.sync_penalty_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.played_on IS DISTINCT FROM OLD.played_on THEN
    UPDATE public.penalties SET penalty_date = NEW.played_on WHERE round_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS rounds_sync_penalty_dates ON public.rounds;
CREATE TRIGGER rounds_sync_penalty_dates AFTER UPDATE OF played_on ON public.rounds FOR EACH ROW EXECUTE FUNCTION public.sync_penalty_dates();