-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.round_status AS ENUM ('open', 'finished');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  handle text NOT NULL UNIQUE,
  handicap numeric(4,1),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- COURSES
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  country text,
  hole_count integer NOT NULL DEFAULT 18,
  par_total integer,
  course_rating numeric(4,1),
  slope_rating integer,
  external_source text,
  external_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX courses_external_unique ON public.courses (external_source, external_id) WHERE external_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  hole_number integer NOT NULL,
  par integer NOT NULL DEFAULT 4,
  stroke_index integer,
  distance_m integer,
  UNIQUE (course_id, hole_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_holes TO authenticated;
GRANT ALL ON public.course_holes TO service_role;
ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;

-- ROUNDS
CREATE TABLE public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  course_name text NOT NULL,
  played_on date NOT NULL DEFAULT current_date,
  hole_count integer NOT NULL DEFAULT 18,
  status public.round_status NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rounds TO authenticated;
GRANT ALL ON public.rounds TO service_role;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.round_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name text,
  position integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT round_player_identity CHECK (profile_id IS NOT NULL OR guest_name IS NOT NULL)
);
CREATE UNIQUE INDEX round_players_profile_unique ON public.round_players (round_id, profile_id) WHERE profile_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_players TO authenticated;
GRANT ALL ON public.round_players TO service_role;
ALTER TABLE public.round_players ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_round_participant(_round_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rounds r WHERE r.id = _round_id AND r.created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.round_players rp WHERE rp.round_id = _round_id AND rp.profile_id = _user_id
  )
$$;

-- SCORES
CREATE TABLE public.hole_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  round_player_id uuid NOT NULL REFERENCES public.round_players(id) ON DELETE CASCADE,
  hole_number integer NOT NULL,
  par integer NOT NULL DEFAULT 4,
  strokes integer,
  putts integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_player_id, hole_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hole_scores TO authenticated;
GRANT ALL ON public.hole_scores TO service_role;
ALTER TABLE public.hole_scores ENABLE ROW LEVEL SECURITY;

-- PENALTIES
CREATE TABLE public.penalty_rules (
  code text PRIMARY KEY,
  label text NOT NULL,
  points integer NOT NULL DEFAULT 1,
  is_automatic boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penalty_rules TO authenticated;
GRANT ALL ON public.penalty_rules TO service_role;
ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;

INSERT INTO public.penalty_rules (code, label, points, is_automatic, description) VALUES
  ('three_putt', 'Dreiputt', 1, true, 'Drei oder mehr Putts auf einem Loch'),
  ('double_par', 'Doppel-Par', 2, true, 'Schlagzahl erreicht oder uebersteigt das doppelte Par'),
  ('girly', 'Girly', 1, false, 'Manuell vergebene Sonderstrafe');

CREATE TABLE public.penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  round_player_id uuid NOT NULL REFERENCES public.round_players(id) ON DELETE CASCADE,
  hole_number integer,
  code text NOT NULL REFERENCES public.penalty_rules(code) ON UPDATE CASCADE,
  points integer NOT NULL DEFAULT 1,
  is_automatic boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX penalties_auto_unique ON public.penalties (round_player_id, hole_number, code) WHERE is_automatic;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penalties TO authenticated;
GRANT ALL ON public.penalties TO service_role;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

-- GPS
CREATE TABLE public.player_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  round_player_id uuid NOT NULL REFERENCES public.round_players(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_m double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_locations_round_idx ON public.player_locations (round_id, recorded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_locations TO authenticated;
GRANT ALL ON public.player_locations TO service_role;
ALTER TABLE public.player_locations ENABLE ROW LEVEL SECURITY;

-- FRIENDSHIPS
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Profiles are readable by signed in users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Courses readable" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Course holes readable" ON public.course_holes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage course holes" ON public.course_holes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Penalty rules readable" ON public.penalty_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage penalty rules" ON public.penalty_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants read rounds" ON public.rounds FOR SELECT TO authenticated USING (public.is_round_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create rounds" ON public.rounds FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Participants update rounds" ON public.rounds FOR UPDATE TO authenticated USING (public.is_round_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.is_round_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creator or admin delete rounds" ON public.rounds FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants read round players" ON public.round_players FOR SELECT TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants manage round players" ON public.round_players FOR INSERT TO authenticated WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants update round players" ON public.round_players FOR UPDATE TO authenticated USING (public.is_round_participant(round_id, auth.uid())) WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants delete round players" ON public.round_players FOR DELETE TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants read scores" ON public.hole_scores FOR SELECT TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants write scores" ON public.hole_scores FOR INSERT TO authenticated WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants update scores" ON public.hole_scores FOR UPDATE TO authenticated USING (public.is_round_participant(round_id, auth.uid())) WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants delete scores" ON public.hole_scores FOR DELETE TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants read penalties" ON public.penalties FOR SELECT TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants write penalties" ON public.penalties FOR INSERT TO authenticated WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants update penalties" ON public.penalties FOR UPDATE TO authenticated USING (public.is_round_participant(round_id, auth.uid())) WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants delete penalties" ON public.penalties FOR DELETE TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants read locations" ON public.player_locations FOR SELECT TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants write locations" ON public.player_locations FOR INSERT TO authenticated WITH CHECK (public.is_round_participant(round_id, auth.uid()));
CREATE POLICY "Participants delete locations" ON public.player_locations FOR DELETE TO authenticated USING (public.is_round_participant(round_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own friendships" ON public.friendships FOR SELECT TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "Users create own friendships" ON public.friendships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own friendships" ON public.friendships FOR DELETE TO authenticated USING (user_id = auth.uid());

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rounds_updated_at BEFORE UPDATE ON public.rounds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER hole_scores_updated_at BEFORE UPDATE ON public.hole_scores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_handle text;
  final_handle text;
  suffix integer := 0;
BEGIN
  base_handle := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'handle', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  IF base_handle IS NULL OR length(base_handle) < 3 THEN
    base_handle := 'golfer';
  END IF;
  final_handle := base_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, handle)
  VALUES (
    NEW.id,
    coalesce(nullif(NEW.raw_user_meta_data->>'display_name', ''), base_handle),
    final_handle
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();