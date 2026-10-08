-- Erweiterte Statistiken für Loch-Scores
ALTER TABLE public.hole_scores ADD COLUMN IF NOT EXISTS tee_direction text;
ALTER TABLE public.hole_scores ADD COLUMN IF NOT EXISTS sand_shots integer NOT NULL DEFAULT 0;
ALTER TABLE public.hole_scores ADD COLUMN IF NOT EXISTS penalty_strokes integer NOT NULL DEFAULT 0;

-- Optional: Constraint für tee_direction
COMMENT ON COLUMN public.hole_scores.tee_direction IS 'Abschlagrichtung: left, hit, right, short';
COMMENT ON COLUMN public.hole_scores.sand_shots IS 'Anzahl der Bunkerschläge';
COMMENT ON COLUMN public.hole_scores.penalty_strokes IS 'Anzahl der Strafschläge';