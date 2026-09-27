CREATE TYPE public.user_type AS ENUM ('active', 'passive', 'guest');

ALTER TABLE public.profiles
  ADD COLUMN user_type public.user_type NOT NULL DEFAULT 'active',
  ADD COLUMN created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;

CREATE POLICY "Users insert managed profiles"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_type IN ('passive','guest') AND created_by = auth.uid());

CREATE POLICY "Users update managed profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (user_type IN ('passive','guest') AND created_by = auth.uid())
WITH CHECK (user_type IN ('passive','guest') AND created_by = auth.uid());

CREATE POLICY "Users delete managed profiles"
ON public.profiles FOR DELETE TO authenticated
USING (user_type IN ('passive','guest') AND created_by = auth.uid());