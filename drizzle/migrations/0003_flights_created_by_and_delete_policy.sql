ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.flights f
SET created_by = r.created_by
FROM public.rounds r
WHERE r.id = f.round_id AND f.created_by IS NULL;

DROP POLICY IF EXISTS "Creator or admin delete flights" ON public.flights;

CREATE POLICY "Flight creator round creator or admin delete flights"
ON public.flights
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.rounds r WHERE r.id = flights.round_id AND r.created_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);