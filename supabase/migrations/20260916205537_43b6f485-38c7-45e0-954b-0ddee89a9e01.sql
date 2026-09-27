CREATE OR REPLACE FUNCTION public.penalty_hall_of_shame()
RETURNS TABLE (profile_id uuid, display_name text, handle text, total_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.handle,
    COALESCE(SUM(pen.amount), 0)::numeric AS total_amount
  FROM public.profiles p
  LEFT JOIN public.round_players rp ON rp.profile_id = p.id
  LEFT JOIN public.rounds r ON r.id = rp.round_id AND r.status = 'finished'
  LEFT JOIN public.penalties pen ON pen.round_player_id = rp.id AND r.id IS NOT NULL
  GROUP BY p.id, p.display_name, p.handle
  ORDER BY total_amount DESC, p.display_name ASC
$$;

REVOKE ALL ON FUNCTION public.penalty_hall_of_shame() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.penalty_hall_of_shame() TO authenticated;