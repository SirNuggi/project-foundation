CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.rounds ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin')
$$;
CREATE OR REPLACE FUNCTION public.can_read_round_via_group(_round_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rounds r JOIN public.group_members gm ON gm.group_id = r.group_id
    WHERE r.id = _round_id AND gm.user_id = _user_id
  )
$$;
CREATE OR REPLACE FUNCTION public.add_group_creator_as_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'admin';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER groups_add_creator AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_group_creator_as_admin();

CREATE POLICY "Members read groups" ON public.groups FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_group_member(id, auth.uid()));
CREATE POLICY "Users create groups" ON public.groups FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins update groups" ON public.groups FOR UPDATE TO authenticated
USING (public.is_group_admin(id, auth.uid()));
CREATE POLICY "Admins delete groups" ON public.groups FOR DELETE TO authenticated
USING (public.is_group_admin(id, auth.uid()));

CREATE POLICY "Members read group members" ON public.group_members FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Admins add group members" ON public.group_members FOR INSERT TO authenticated
WITH CHECK (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Admins update group members" ON public.group_members FOR UPDATE TO authenticated
USING (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Admins or self delete group members" ON public.group_members FOR DELETE TO authenticated
USING (public.is_group_admin(group_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Group members read rounds" ON public.rounds FOR SELECT TO authenticated
USING (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Group members read round players" ON public.round_players FOR SELECT TO authenticated
USING (public.can_read_round_via_group(round_id, auth.uid()));
CREATE POLICY "Group members read flights" ON public.flights FOR SELECT TO authenticated
USING (public.can_read_round_via_group(round_id, auth.uid()));
CREATE POLICY "Group members read scores" ON public.hole_scores FOR SELECT TO authenticated
USING (public.can_read_round_via_group(round_id, auth.uid()));
CREATE POLICY "Group members read penalties" ON public.penalties FOR SELECT TO authenticated
USING (public.can_read_round_via_group(round_id, auth.uid()));