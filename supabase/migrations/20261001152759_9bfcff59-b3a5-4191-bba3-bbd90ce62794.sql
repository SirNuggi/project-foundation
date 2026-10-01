ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS has_penalty_fund boolean NOT NULL DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS membership_fee numeric(6,2) NOT NULL DEFAULT 0.00;

CREATE TABLE public.group_penalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  amount numeric(6,2) NOT NULL DEFAULT 0.50,
  is_automatic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_penalty_rules TO authenticated;
GRANT ALL ON public.group_penalty_rules TO service_role;
ALTER TABLE public.group_penalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read group penalty rules" ON public.group_penalty_rules FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Admins insert group penalty rules" ON public.group_penalty_rules FOR INSERT TO authenticated WITH CHECK (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Admins update group penalty rules" ON public.group_penalty_rules FOR UPDATE TO authenticated USING (public.is_group_admin(group_id, auth.uid())) WITH CHECK (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Admins delete group penalty rules" ON public.group_penalty_rules FOR DELETE TO authenticated USING (public.is_group_admin(group_id, auth.uid()));