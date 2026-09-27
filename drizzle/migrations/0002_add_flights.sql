CREATE TABLE public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  flight_number integer NOT NULL,
  status public.round_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, flight_number)
);

CREATE INDEX flights_round_id_idx ON public.flights(round_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flights TO authenticated;
GRANT ALL ON public.flights TO service_role;

ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read flights" ON public.flights
  FOR SELECT TO authenticated
  USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants insert flights" ON public.flights
  FOR INSERT TO authenticated
  WITH CHECK (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants update flights" ON public.flights
  FOR UPDATE TO authenticated
  USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator or admin delete flights" ON public.flights
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rounds r WHERE r.id = flights.round_id AND r.created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.round_players ADD COLUMN flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL;

CREATE INDEX round_players_flight_id_idx ON public.round_players(flight_id);

INSERT INTO public.flights (round_id, flight_number, status)
SELECT r.id, 1, r.status FROM public.rounds r;

UPDATE public.round_players rp
SET flight_id = f.id
FROM public.flights f
WHERE f.round_id = rp.round_id AND f.flight_number = 1 AND rp.flight_id IS NULL;

ALTER TABLE public.flights REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flights;
ALTER TABLE public.round_players REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_players;
