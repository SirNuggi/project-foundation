import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildRoundHoles,
  courseHandicap,
  playingHandicap,
  type HoleInfo,
} from "@/lib/stableford";

const teeBoxSchema = z.object({
  name: z.string().trim().min(1).max(30),
  slope: z.number().int().min(55).max(155),
  courseRating: z.number().min(40).max(90),
});

const playerSchema = z.object({
  profileId: z.string().uuid().nullable().optional(),
  guestName: z.string().trim().min(1).max(50).nullable().optional(),
  teeBoxId: z.string().uuid().nullable().optional(),
  teeName: z.string().trim().max(30).nullable().optional(),
  handicapIndex: z.number().min(-60).max(60).optional(),
});

const newCourseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().max(80).optional(),
  holeCount: z.union([z.literal(9), z.literal(18)]),
  teeBoxes: z.array(teeBoxSchema).min(1).max(6),
  holes: z
    .array(
      z.object({
        holeNumber: z.number().int().min(1).max(18),
        par: z.number().int().min(3).max(6),
        strokeIndex: z.number().int().min(1).max(18),
        strokeIndexBack: z.number().int().min(1).max(18).nullable().optional(),
      }),
    )
    .min(9)
    .max(18),
});

const flightSchema = z.object({
  players: z.array(playerSchema).max(6),
});

const createRoundSchema = z.object({
  name: z.string().trim().max(100).nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  courseName: z.string().trim().min(1).max(100),
  newCourse: newCourseSchema.nullable().optional(),
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  holeCount: z.union([z.literal(9), z.literal(18)]),
  myTeeBoxId: z.string().uuid().nullable().optional(),
  myTeeName: z.string().trim().max(30).nullable().optional(),
  myHandicapIndex: z.number().min(-60).max(60).nullable().optional(),
  withPenalties: z.boolean().optional(),
  flights: z.array(flightSchema).min(1).max(20),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Frisch ausgestellte Tokens gelten bei kleiner Uhrabweichung kurz als
    // "in der Zukunft ausgestellt" — dann kurz warten und erneut versuchen.
    const loadProfile = () =>
      context.supabase
        .from("profiles")
        .select("id, display_name, handle, handicap, handicap_index, default_tee, avatar_url")
        .eq("id", context.userId)
        .maybeSingle();
    let { data, error } = await loadProfile();
    for (let i = 0; i < 3 && error && /issued at future/i.test(error.message); i++) {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      ({ data, error } = await loadProfile());
    }
    if (error) throw new Error(error.message);

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    return {
      profile: data
        ? { ...data, handicap_index: Number(data.handicap_index ?? -54) }
        : null,
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        displayName: z.string().trim().min(2).max(50),
        handicapIndex: z.number().min(-60).max(60),
        defaultTee: z.string().trim().min(1).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        handicap_index: Math.round(data.handicapIndex * 10) / 10,
        default_tee: data.defaultTee,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const passivePlayerSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  handicapIndex: z.number().min(-60).max(60),
  defaultTee: z.string().trim().min(1).max(30),
});

export const listMyPassivePlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, handle, handicap_index, default_tee, user_type")
      .eq("created_by", context.userId)
      .eq("user_type", "passive")
      .order("display_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((profile) => ({
      ...profile,
      handicap_index: Number(profile.handicap_index ?? 54),
    }));
  });

export const createPassivePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => passivePlayerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const id = crypto.randomUUID();
    const handle = `spieler_${id.replaceAll("-", "")}`;
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .insert({
        id,
        display_name: data.displayName,
        handle,
        handicap_index: Math.round(data.handicapIndex * 10) / 10,
        default_tee: data.defaultTee,
        user_type: "passive",
        created_by: context.userId,
      })
      .select("id, display_name, handle, handicap_index, default_tee, user_type")
      .single();
    if (error || !profile) throw new Error(error?.message ?? "Spieler konnte nicht angelegt werden");
    return { ...profile, handicap_index: Number(profile.handicap_index ?? 54) };
  });

export const updatePassivePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    passivePlayerSchema.extend({ profileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        handicap_index: Math.round(data.handicapIndex * 10) / 10,
        default_tee: data.defaultTee,
      })
      .eq("id", data.profileId)
      .eq("created_by", context.userId)
      .eq("user_type", "passive")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Dieser Spieler kann nicht bearbeitet werden");
    return { ok: true };
  });

export const deletePassivePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ profileId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", data.profileId)
      .eq("created_by", context.userId)
      .eq("user_type", "passive")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Dieser Spieler kann nicht gelöscht werden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: historyError } = await supabaseAdmin
      .from("round_players")
      .update({ profile_id: null, guest_name: profile.display_name })
      .eq("profile_id", profile.id);
    if (historyError) throw new Error(historyError.message);

    const { error: deleteError } = await supabaseAdmin.from("profiles").delete().eq("id", profile.id);
    if (deleteError) throw new Error(deleteError.message);
    return { ok: true };
  });

export const listMyRounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rounds")
      .select("id, name, course_name, played_on, created_at, hole_count, status, round_players(id), flights(id)")
      .order("played_on", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      roundName: r.name ?? null,
      courseName: r.course_name,
      playedOn: r.played_on,
      createdAt: r.created_at,
      holeCount: r.hole_count,
      status: r.status,
      playerCount: r.round_players?.length ?? 0,
      flightCount: r.flights?.length ?? 0,
    }));
  });

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select("id, name, city, hole_count, tee_boxes(id, name, slope, course_rating)")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      hole_count: c.hole_count,
      teeBoxes: (c.tee_boxes ?? [])
        .map((t) => ({
          id: t.id as string,
          name: t.name as string,
          slope: Number(t.slope ?? 113),
          courseRating: Number(t.course_rating ?? 70),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    }));
  });

export const searchPlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => z.object({ q: z.string().trim().max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    // Leere Suche liefert eine Schnellauswahl-Liste; 1 Zeichen ist zu unspezifisch.
    if (data.q.length === 1) return [];
    const term = data.q.replace(/[%,()]/g, "");
    let query = context.supabase
      .from("profiles")
      .select("id, display_name, handle, handicap_index, default_tee, avatar_url, user_type")
      .or(`user_type.eq.active,and(user_type.eq.passive,created_by.eq.${context.userId})`)
      .neq("id", context.userId);
    if (term) query = query.or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`);
    const { data: rows, error } = await query.order("display_name").limit(term ? 10 : 20);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      handicap_index: Number(r.handicap_index ?? -54),
      default_tee: (r.default_tee ?? "Gelb") as string,
    }));
  });

export const createRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createRoundSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    let courseId = data.courseId ?? null;
    let courseName = data.courseName;

    // Play-and-save: neuer Platz wird dauerhaft gespeichert
    if (!courseId && data.newCourse) {
      const nc = data.newCourse;
      const parTotal = nc.holes.reduce((sum, h) => sum + h.par, 0);
      const { data: course, error: courseError } = await sb
        .from("courses")
        .insert({
          name: nc.name,
          city: nc.city || null,
          hole_count: nc.holeCount,
          par_total: parTotal,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (courseError || !course)
        throw new Error(courseError?.message ?? "Platz konnte nicht gespeichert werden");
      courseId = course.id;
      courseName = nc.name;

      const { error: holeError } = await sb.from("course_holes").insert(
        nc.holes.map((h) => ({
          course_id: course.id,
          hole_number: h.holeNumber,
          par: h.par,
          stroke_index: h.strokeIndex,
          stroke_index_back: h.strokeIndexBack ?? null,
        })),
      );
      if (holeError) throw new Error(holeError.message);

      const { error: teeError } = await sb.from("tee_boxes").insert(
        nc.teeBoxes.map((t) => ({
          course_id: course.id,
          name: t.name,
          slope: t.slope,
          course_rating: t.courseRating,
        })),
      );
      if (teeError) throw new Error(teeError.message);
    }

    // Platzdaten für die Spielvorgabe laden
    let holes: HoleInfo[] = [];
    let fullHoles: HoleInfo[] = [];
    let teeBoxes: { id: string; name: string; slope: number; courseRating: number }[] = [];
    if (courseId) {
      const [{ data: teeRows }, { data: courseRow }, { data: holeRows }] = await Promise.all([
        sb.from("tee_boxes").select("id, name, slope, course_rating").eq("course_id", courseId),
        sb.from("courses").select("hole_count").eq("id", courseId).maybeSingle(),
        sb
          .from("course_holes")
          .select("hole_number, par, stroke_index, stroke_index_back")
          .eq("course_id", courseId)
          .order("hole_number"),
      ]);
      teeBoxes = (teeRows ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        slope: Number(t.slope ?? 113),
        courseRating: Number(t.course_rating ?? 70),
      }));
      const courseHoleCount = Number(courseRow?.hole_count ?? data.holeCount);
      holes = buildRoundHoles(holeRows ?? [], courseHoleCount, data.holeCount);
      fullHoles = buildRoundHoles(holeRows ?? [], courseHoleCount, 18);
    }
    // Slope/CR der Abschläge sind 18-Loch-Werte: Course Handicap immer auf 18 rechnen
    // und bei einer 9-Loch-Runde anschließend halbieren.
    const parTotal18 = fullHoles.reduce((sum, h) => sum + h.par, 0) || 72;

    const { data: me } = await sb
      .from("profiles")
      .select("handicap_index, default_tee")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: round, error } = await sb
      .from("rounds")
      .insert({
        name: data.name?.trim() ? data.name.trim().slice(0, 100) : null,
        group_id: data.groupId ?? null,
        course_id: courseId,
        course_name: courseName,
        played_on: data.playedOn,
        hole_count: data.holeCount,
        with_penalties: data.withPenalties ?? true,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !round) throw new Error(error?.message ?? "Runde konnte nicht angelegt werden");

    function resolveTee(teeBoxId?: string | null, teeName?: string | null) {
      return (
        teeBoxes.find((t) => t.id === teeBoxId) ??
        teeBoxes.find((t) => t.name.toLowerCase() === (teeName ?? "").toLowerCase()) ??
        teeBoxes[0] ??
        null
      );
    }

    function hcpFor(
      handicapIndex: number,
      tee: { slope: number; courseRating: number } | null,
    ) {
      const full = courseHandicap(
        handicapIndex,
        tee?.slope ?? 103,
        tee?.courseRating ?? 63.1,
        parTotal18,
      );
      return playingHandicap(full, data.holeCount);
    }

    const myTee = resolveTee(data.myTeeBoxId, data.myTeeName ?? me?.default_tee ?? null);
    const myIndex = data.myHandicapIndex ?? Number(me?.handicap_index ?? -54);

    const { data: flightRows, error: flightError } = await sb
      .from("flights")
      .insert(
        data.flights.map((_, i) => ({
          round_id: round.id,
          flight_number: i + 1,
          created_by: context.userId,
        })),
      )
      .select("id, flight_number");
    if (flightError || !flightRows)
      throw new Error(flightError?.message ?? "Flights konnten nicht angelegt werden");
    const flightIdByNumber = new Map<number, string>(
      flightRows.map((f) => [f.flight_number, f.id as string]),
    );

    const rows: {
      round_id: string;
      flight_id: string | null;
      profile_id: string | null;
      guest_name: string | null;
      position: number;
      handicap_index: number;
      tee: string | null;
      tee_box_id: string | null;
      course_handicap: number;
    }[] = [];
    let position = 1;
    // Der Ersteller steht immer in Flight 1
    const creatorInFlights = data.flights.some((f) =>
      f.players.some((p) => p.profileId === context.userId),
    );
    if (!creatorInFlights) {
      rows.push({
        round_id: round.id,
        flight_id: flightIdByNumber.get(1) ?? null,
        profile_id: context.userId,
        guest_name: null,
        position: position++,
        handicap_index: myIndex,
        tee: myTee?.name ?? null,
        tee_box_id: myTee?.id ?? null,
        course_handicap: hcpFor(myIndex, myTee),
      });
    }

    data.flights.forEach((flight, fi) => {
      for (const p of flight.players) {
        const isMe = p.profileId === context.userId;
        const tee = isMe
          ? resolveTee(p.teeBoxId ?? data.myTeeBoxId, p.teeName ?? data.myTeeName)
          : resolveTee(p.teeBoxId, p.teeName);
        const index = isMe ? myIndex : (p.handicapIndex ?? -54);
        rows.push({
          round_id: round.id,
          flight_id: flightIdByNumber.get(fi + 1) ?? null,
          profile_id: p.profileId ?? null,
          guest_name: p.profileId ? null : (p.guestName ?? null),
          position: position++,
          handicap_index: index,
          tee: tee?.name ?? null,
          tee_box_id: tee?.id ?? null,
          course_handicap: hcpFor(index, tee),
        });
      }
    });

    const { error: playerError } = await sb.from("round_players").insert(rows);
    if (playerError) throw new Error(playerError.message);

    return { id: round.id };
  });

export const getRoundBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roundId: string }) =>
    z.object({ roundId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: round, error } = await sb
      .from("rounds")
      .select(
        "id, name, course_id, course_name, played_on, created_at, hole_count, status, with_penalties, created_by, flights(id, flight_number, status, created_by), round_players(id, guest_name, position, profile_id, flight_id, tee, handicap_index, course_handicap, profiles(display_name, handle))",
      )
      .eq("id", data.roundId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!round) return null;

    const [holes, scores, penalties, rules] = await Promise.all([
      round.course_id
        ? sb
            .from("course_holes")
            .select("hole_number, par, stroke_index, stroke_index_back")
            .eq("course_id", round.course_id)
        : Promise.resolve({
            data: [] as {
              hole_number: number;
              par: number;
              stroke_index: number | null;
              stroke_index_back?: number | null;
            }[],
          }),
      sb
        .from("hole_scores")
        .select("id, round_player_id, hole_number, strokes, putts")
        .eq("round_id", data.roundId),
      sb
        .from("penalties")
        .select("id, round_player_id, hole_number, code, points, amount")
        .eq("round_id", data.roundId),
      sb.from("penalty_rules").select("code, label, points, amount, is_automatic"),
    ]);

    const courseRows = holes.data ?? [];
    const courseHoleCount = courseRows.reduce((max, h) => Math.max(max, h.hole_number), 0) || 18;
    const roundHoles = buildRoundHoles(courseRows, courseHoleCount, round.hole_count);

    const pars: Record<number, number> = {};
    const strokeIndexes: Record<number, number> = {};
    for (const h of roundHoles) {
      pars[h.holeNumber] = h.par;
      strokeIndexes[h.holeNumber] = h.strokeIndex;
    }

    const flights = (round.flights ?? [])
      .map((f) => ({
        id: f.id as string,
        number: f.flight_number as number,
        status: (f.status ?? "open") as string,
      }))
      .sort((a, b) => a.number - b.number);
    const flightNumberById = new Map(flights.map((f) => [f.id, f.number]));

    const players = (round.round_players ?? [])
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        profileId: p.profile_id ?? null,
        name: p.profiles?.display_name ?? p.guest_name ?? "Spieler",
        handle: p.profiles?.handle ?? null,
        isGuest: !p.profile_id,
        tee: (p.tee ?? "") as string,
        handicapIndex: p.handicap_index === null ? null : Number(p.handicap_index),
        courseHandicap: p.course_handicap ?? 0,
        flightId: (p.flight_id ?? null) as string | null,
        flightNumber: p.flight_id ? (flightNumberById.get(p.flight_id) ?? null) : null,
      }));

    const mine = players.find((p) => p.profileId === context.userId) ?? null;
    const myFlightId = mine?.flightId ?? flights[0]?.id ?? null;
    const isCreator = round.created_by === context.userId;
    const myFlightRow = (round.flights ?? []).find((f) => f.id === myFlightId) ?? null;
    const canDeleteMyFlight =
      !!myFlightId && (isCreator || (myFlightRow?.created_by ?? null) === context.userId);

    return {
      id: round.id,
      roundName: round.name ?? null,
      courseName: round.course_name,
      playedOn: round.played_on,
      createdAt: round.created_at,
      holeCount: round.hole_count,
      status: round.status,
      withPenalties: round.with_penalties ?? true,
      courseHoleCount,
      isCreator,
      canDeleteMyFlight,
      flights,
      myFlightId,
      myRoundPlayerId: mine?.id ?? null,
      pars,
      strokeIndexes,
      players,
      scores: scores.data ?? [],
      penalties: penalties.data ?? [],
      rules: rules.data ?? [],
    };
  });

async function syncAutoPenalties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  args: {
    roundId: string;
    roundPlayerId: string;
    holeNumber: number;
    par: number;
    strokes: number;
    putts: number;
    userId: string;
  },
) {
  const { data: rules } = await sb
    .from("penalty_rules")
    .select("code, points, amount")
    .in("code", ["double_par", "three_putt"]);
  const ruleFor = (code: string) =>
    (rules ?? []).find((r: { code: string }) => r.code === code) as
      | { code: string; points: number; amount: number }
      | undefined;
  const pointsFor = (code: string) => ruleFor(code)?.points ?? 1;
  const amountFor = (code: string) => Number(ruleFor(code)?.amount ?? 0);

  const active: Record<string, boolean> = {
    double_par: args.strokes >= args.par * 2,
    three_putt: args.putts >= 3,
  };

  for (const code of ["double_par", "three_putt"]) {
    if (active[code]) {
      await sb.from("penalties").upsert(
        {
          round_id: args.roundId,
          round_player_id: args.roundPlayerId,
          hole_number: args.holeNumber,
          code,
          points: pointsFor(code),
          amount: amountFor(code),
          is_automatic: true,
          created_by: args.userId,
        },
        { onConflict: "round_player_id,hole_number,code" },
      );
    } else {
      await sb
        .from("penalties")
        .delete()
        .eq("round_player_id", args.roundPlayerId)
        .eq("hole_number", args.holeNumber)
        .eq("code", code);
    }
  }
}

export const saveHoleScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        roundId: z.string().uuid(),
        roundPlayerId: z.string().uuid(),
        holeNumber: z.number().int().min(1).max(18),
        par: z.number().int().min(3).max(6),
        strokes: z.number().int().min(1).max(20),
        putts: z.number().int().min(0).max(15),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb.from("hole_scores").upsert(
      {
        round_id: data.roundId,
        round_player_id: data.roundPlayerId,
        hole_number: data.holeNumber,
        par: data.par,
        strokes: data.strokes,
        putts: data.putts,
      },
      { onConflict: "round_player_id,hole_number" },
    );
    if (error) throw new Error(error.message);

    const { data: roundRow } = await sb
      .from("rounds")
      .select("with_penalties")
      .eq("id", data.roundId)
      .maybeSingle();

    if (roundRow?.with_penalties !== false) {
      await syncAutoPenalties(sb, {
        roundId: data.roundId,
        roundPlayerId: data.roundPlayerId,
        holeNumber: data.holeNumber,
        par: data.par,
        strokes: data.strokes,
        putts: data.putts,
        userId: context.userId,
      });
    }

    return { ok: true };
  });

export const toggleGirly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        roundId: z.string().uuid(),
        roundPlayerId: z.string().uuid(),
        holeNumber: z.number().int().min(1).max(18),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: roundRow } = await sb
      .from("rounds")
      .select("with_penalties")
      .eq("id", data.roundId)
      .maybeSingle();
    if (roundRow?.with_penalties === false) return { ok: true };
    if (data.active) {
      const { data: rule } = await sb
        .from("penalty_rules")
        .select("points, amount")
        .eq("code", "girly")
        .maybeSingle();
      const { error } = await sb.from("penalties").upsert(
        {
          round_id: data.roundId,
          round_player_id: data.roundPlayerId,
          hole_number: data.holeNumber,
          code: "girly",
          points: rule?.points ?? 1,
          amount: Number(rule?.amount ?? 0),
          is_automatic: false,
          created_by: context.userId,
        },
        { onConflict: "round_player_id,hole_number,code" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb
        .from("penalties")
        .delete()
        .eq("round_player_id", data.roundPlayerId)
        .eq("hole_number", data.holeNumber)
        .eq("code", "girly");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const finishFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roundId: z.string().uuid(), flightId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("flights")
      .update({ status: "finished" })
      .eq("id", data.flightId)
      .eq("round_id", data.roundId);
    if (error) throw new Error(error.message);

    const { data: open } = await sb
      .from("flights")
      .select("id")
      .eq("round_id", data.roundId)
      .neq("status", "finished");

    const roundFinished = (open ?? []).length === 0;
    if (roundFinished) {
      const { error: roundError } = await sb
        .from("rounds")
        .update({ status: "finished" })
        .eq("id", data.roundId);
      if (roundError) throw new Error(roundError.message);
    }
    return { ok: true, roundFinished };
  });

export const addPlayerToFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        roundId: z.string().uuid(),
        flightId: z.string().uuid(),
        profileId: z.string().uuid().nullable().optional(),
        guestName: z.string().trim().min(1).max(50).nullable().optional(),
        teeBoxId: z.string().uuid().nullable().optional(),
        teeName: z.string().trim().max(30).nullable().optional(),
        handicapIndex: z.number().min(-60).max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (!data.profileId && !data.guestName) throw new Error("Spieler oder Gastname fehlt");

    const { data: round } = await sb
      .from("rounds")
      .select("id, course_id, hole_count, round_players(id, profile_id, position)")
      .eq("id", data.roundId)
      .maybeSingle();
    if (!round) throw new Error("Runde nicht gefunden");

    if (
      data.profileId &&
      (round.round_players ?? []).some((p) => p.profile_id === data.profileId)
    ) {
      throw new Error("Dieser Spieler ist bereits in der Runde");
    }

    let teeBoxes: { id: string; name: string; slope: number; courseRating: number }[] = [];
    let parTotal18 = 72;
    if (round.course_id) {
      const [{ data: teeRows }, { data: courseRow }, { data: holeRows }] = await Promise.all([
        sb.from("tee_boxes").select("id, name, slope, course_rating").eq("course_id", round.course_id),
        sb.from("courses").select("hole_count").eq("id", round.course_id).maybeSingle(),
        sb
          .from("course_holes")
          .select("hole_number, par, stroke_index, stroke_index_back")
          .eq("course_id", round.course_id)
          .order("hole_number"),
      ]);
      teeBoxes = (teeRows ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        slope: Number(t.slope ?? 113),
        courseRating: Number(t.course_rating ?? 70),
      }));
      const courseHoleCount = Number(courseRow?.hole_count ?? round.hole_count);
      const fullHoles = buildRoundHoles(holeRows ?? [], courseHoleCount, 18);
      parTotal18 = fullHoles.reduce((sum, h) => sum + h.par, 0) || 72;
    }

    let handicapIndex = data.handicapIndex ?? -54;
    let teeName = data.teeName ?? null;
    if (data.profileId) {
      const { data: profile } = await sb
        .from("profiles")
        .select("handicap_index, default_tee")
        .eq("id", data.profileId)
        .maybeSingle();
      handicapIndex = data.handicapIndex ?? Number(profile?.handicap_index ?? -54);
      teeName = teeName ?? profile?.default_tee ?? null;
    }

    const tee =
      teeBoxes.find((t) => t.id === data.teeBoxId) ??
      teeBoxes.find((t) => t.name.toLowerCase() === (teeName ?? "").toLowerCase()) ??
      teeBoxes[0] ??
      null;

    const full = courseHandicap(
      handicapIndex,
      tee?.slope ?? 103,
      tee?.courseRating ?? 63.1,
      parTotal18,
    );
    const position =
      (round.round_players ?? []).reduce((max, p) => Math.max(max, p.position ?? 0), 0) + 1;

    const { error } = await sb.from("round_players").insert({
      round_id: data.roundId,
      flight_id: data.flightId,
      profile_id: data.profileId ?? null,
        guest_name: data.guestName ?? null,
      position,
      handicap_index: handicapIndex,
      tee: tee?.name ?? null,
      tee_box_id: tee?.id ?? null,
      course_handicap: playingHandicap(full, round.hole_count === 9 ? 9 : 18),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: existing } = await sb
      .from("flights")
      .select("flight_number")
      .eq("round_id", data.roundId);
    const next = (existing ?? []).reduce((max, f) => Math.max(max, f.flight_number), 0) + 1;
    const { data: row, error } = await sb
      .from("flights")
      .insert({ round_id: data.roundId, flight_number: next, created_by: context.userId })
      .select("id, flight_number")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Flight konnte nicht angelegt werden");
    return { id: row.id, number: row.flight_number };
  });

export const deleteFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roundId: z.string().uuid(), flightId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: flight } = await sb
      .from("flights")
      .select("id, round_id, created_by")
      .eq("id", data.flightId)
      .eq("round_id", data.roundId)
      .maybeSingle();
    if (!flight) throw new Error("Flight nicht gefunden");

    const { data: round } = await sb
      .from("rounds")
      .select("id, created_by")
      .eq("id", data.roundId)
      .maybeSingle();
    if (!round) throw new Error("Runde nicht gefunden");

    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const allowed =
      flight.created_by === context.userId || round.created_by === context.userId || !!isAdmin;
    if (!allowed) throw new Error("Keine Berechtigung, diesen Flight zu löschen");

    const { data: playerRows } = await sb
      .from("round_players")
      .select("id")
      .eq("flight_id", data.flightId);
    const playerIds = (playerRows ?? []).map((p) => p.id as string);

    if (playerIds.length > 0) {
      await sb.from("penalties").delete().in("round_player_id", playerIds);
      await sb.from("hole_scores").delete().in("round_player_id", playerIds);
      await sb.from("player_locations").delete().in("round_player_id", playerIds);
      const { error: playerError } = await sb.from("round_players").delete().in("id", playerIds);
      if (playerError) throw new Error(playerError.message);
    }

    const { error: flightError } = await sb.from("flights").delete().eq("id", data.flightId);
    if (flightError) throw new Error(flightError.message);

    const { data: remaining } = await sb
      .from("flights")
      .select("id")
      .eq("round_id", data.roundId);

    let roundDeleted = false;
    if ((remaining ?? []).length === 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: roundError } = await supabaseAdmin
        .from("rounds")
        .delete()
        .eq("id", data.roundId);
      if (roundError) throw new Error(roundError.message);
      roundDeleted = true;
    }

    return { ok: true, roundDeleted };
  });

export const finishRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("flights")
      .update({ status: "finished" })
      .eq("round_id", data.roundId);
    const { error } = await context.supabase
      .from("rounds")
      .update({ status: "finished" })
      .eq("id", data.roundId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roundId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rounds")
      .delete()
      .eq("id", data.roundId)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRound = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roundId: string }) =>
    z.object({ roundId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: round, error } = await context.supabase
      .from("rounds")
      .select(
        "id, course_name, played_on, hole_count, status, created_by, round_players(id, guest_name, position, profile_id, profiles(display_name, handle))",
      )
      .eq("id", data.roundId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!round) return null;

    return {
      id: round.id,
      courseName: round.course_name,
      playedOn: round.played_on,
      holeCount: round.hole_count,
      status: round.status,
      players: (round.round_players ?? [])
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          id: p.id,
          name: p.profiles?.display_name ?? p.guest_name ?? "Spieler",
          handle: p.profiles?.handle ?? null,
          isGuest: !p.profile_id,
        })),
    };
  });
