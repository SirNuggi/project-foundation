ALTER TABLE public.hole_scores REPLICA IDENTITY FULL;
ALTER TABLE public.penalties REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hole_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.penalties;
CREATE UNIQUE INDEX IF NOT EXISTS penalties_unique_player_hole_code ON public.penalties (round_player_id, hole_number, code);
CREATE UNIQUE INDEX IF NOT EXISTS hole_scores_unique_player_hole ON public.hole_scores (round_player_id, hole_number);