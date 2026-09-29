ALTER TABLE public.penalties ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

UPDATE public.penalties p
SET group_id = r.group_id
FROM public.round_players rp
JOIN public.rounds r ON r.id = rp.round_id
JOIN public.group_members gm ON gm.group_id = r.group_id AND gm.user_id = rp.profile_id
WHERE p.round_player_id = rp.id
  AND r.group_id IS NOT NULL;
