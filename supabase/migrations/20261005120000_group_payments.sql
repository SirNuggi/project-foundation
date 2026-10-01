CREATE TABLE public.group_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(6,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('penalty', 'membership_fee')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_payments TO authenticated;
GRANT ALL ON public.group_payments TO service_role;

ALTER TABLE public.group_payments ENABLE ROW LEVEL SECURITY;

-- Lesezugriff: Nur für Gruppen-Admins ODER wenn user_id = auth.uid() (eigene Zahlungen)
CREATE POLICY "Group admins and owners read group payments" ON public.group_payments
  FOR SELECT TO authenticated
  USING (
    is_group_admin(group_id, auth.uid()) OR user_id = auth.uid()
  );

-- Schreibzugriff (Insert/Delete): Nur für Gruppen-Admins
CREATE POLICY "Group admins insert group payments" ON public.group_payments
  FOR INSERT TO authenticated
  WITH CHECK (is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins delete group payments" ON public.group_payments
  FOR DELETE TO authenticated
  USING (is_group_admin(group_id, auth.uid()));