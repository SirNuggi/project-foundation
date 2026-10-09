import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateGolfStatistics } from "@/lib/golf-statistics";

export type StatsRound = {
  id: string;
  courseName: string;
  playedOn: string;
  holeCount: number;
  euro: number;
};

export type UserGroup = {
  id: string;
  name: string;
};

/** Pseudo-Gruppe für Strafen ohne Gruppen-Zuordnung */
export const OTHER_GROUP_ID = "other";

export const getUserGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("group_members")
      .select("group_id, groups!inner(id, name)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((m) => Boolean(m.groups))
      .map((m) => {
        const g = m.groups as unknown as { id: string; name: string };
        return {
          id: g.id,
          name: g.name,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;

    const { data: entries, error } = await sb
      .from("round_players")
      .select("id, round_id, rounds!inner(id, course_name, played_on, hole_count, status)")
      .eq("profile_id", context.userId)
      .eq("rounds.status", "finished");
    if (error) throw new Error(error.message);

    const rows = entries ?? [];
    const playerIds = rows.map((r) => r.id);

    const [penaltiesRes, rulesRes] = await Promise.all([
      playerIds.length
        ? sb
            .from("penalties")
            .select("round_player_id, code, amount")
            .in("round_player_id", playerIds)
        : Promise.resolve({ data: [] as { round_player_id: string; code: string; amount: number }[] }),
      sb.from("penalty_rules").select("code, label"),
    ]);

    const penalties = (penaltiesRes.data ?? []) as {
      round_player_id: string;
      code: string;
      amount: number | string;
    }[];
    const labels: Record<string, string> = {};
    for (const r of rulesRes.data ?? []) labels[r.code] = r.label;

    const euroByPlayerRow: Record<string, number> = {};
    const breakdownMap: Record<string, { count: number; amount: number }> = {};
    let totalEuro = 0;

    for (const p of penalties) {
      const amount = Number(p.amount ?? 0);
      totalEuro += amount;
      euroByPlayerRow[p.round_player_id] = (euroByPlayerRow[p.round_player_id] ?? 0) + amount;
      const entry = breakdownMap[p.code] ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += amount;
      breakdownMap[p.code] = entry;
    }

    const rounds: StatsRound[] = rows
      .map((r) => {
        const round = r.rounds as unknown as {
          id: string;
          course_name: string;
          played_on: string;
          hole_count: number;
        };
        return {
          id: round.id,
          courseName: round.course_name,
          playedOn: round.played_on,
          holeCount: round.hole_count,
          euro: Math.round((euroByPlayerRow[r.id] ?? 0) * 100) / 100,
        };
      })
      .sort((a, b) => (a.playedOn < b.playedOn ? 1 : -1));

    const courseCounts: Record<string, number> = {};
    for (const r of rounds) courseCounts[r.courseName] = (courseCounts[r.courseName] ?? 0) + 1;
    const favourite =
      Object.entries(courseCounts).sort((a, b) => b[1] - a[1])[0] ?? null;

    return {
      roundCount: rounds.length,
      totalEuro: Math.round(totalEuro * 100) / 100,
      favouriteCourse: favourite ? { name: favourite[0], count: favourite[1] } : null,
      breakdown: Object.entries(breakdownMap)
        .map(([code, v]) => ({
          code,
          label: labels[code] ?? code,
          count: v.count,
          amount: Math.round(v.amount * 100) / 100,
        }))
        .sort((a, b) => b.amount - a.amount),
      rounds,
    };
  });

export const getMyGolfStatistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: entries, error } = await context.supabase
      .from("round_players")
      .select("id, profile_id, rounds!inner(id, course_name, played_on, hole_count, status)")
      .eq("profile_id", context.userId)
      .eq("rounds.status", "finished");
    if (error) throw new Error(error.message);

    const rounds = (entries ?? []).map((entry) => ({
      playerId: entry.id,
      profileId: entry.profile_id ?? "",
      roundId: entry.rounds.id,
      status: entry.rounds.status,
      playedOn: entry.rounds.played_on,
      courseName: entry.rounds.course_name,
      holeCount: entry.rounds.hole_count,
    }));

    // Page explicitly: Supabase caps responses, which must not truncate long-term stats.
    const scores: import("@/lib/golf-statistics").GolfStatsScore[] = [];
    const playerIds = rounds.map((round) => round.playerId);
    for (let chunk = 0; chunk < playerIds.length; chunk += 100) {
      const ids = playerIds.slice(chunk, chunk + 100);
      for (let offset = 0; ; offset += 500) {
        const { data, error: scoreError } = await context.supabase
          .from("hole_scores")
          .select("round_player_id, hole_number, par, strokes, putts, tee_direction")
          .in("round_player_id", ids)
          .order("id")
          .range(offset, offset + 499);
        if (scoreError) throw new Error(scoreError.message);
        scores.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }
    }
    // Use the hole par saved with each score, never a handicap-adjusted personal par.
    return calculateGolfStatistics(context.userId, rounds, scores);
  });

export const getHallOfShame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string }) => input)
  .handler(async ({ data: inputData, context }) => {
    const groupId = inputData?.groupId;

    if (groupId === OTHER_GROUP_ID) {
      // "Sonstige": Strafen ohne Gruppe des aktuellen Users aus beendeten Runden
      const sb = context.supabase;
      const { data: pen, error: penErr } = await sb
        .from("penalties")
        .select("amount, rounds!inner(status), round_players!inner(profile_id, profiles(id, display_name, handle))")
        .is("group_id", null)
        .eq("rounds.status", "finished")
        .eq("round_players.profile_id", context.userId);
      if (penErr) throw new Error(penErr.message);
      const { data: me } = await sb
        .from("profiles")
        .select("id, display_name, handle")
        .eq("id", context.userId)
        .maybeSingle();
      const euro = (pen ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
      return [
        {
          id: context.userId,
          name: me?.display_name || me?.handle || "Ich",
          handle: me?.handle || "",
          euro: Math.round(euro * 100) / 100,
        },
      ];
    }

    if (groupId) {
      const sb = context.supabase;

      // 1. Alle Mitglieder der Gruppe abrufen
      const { data: members, error: gmError } = await sb
        .from("group_members")
        .select("user_id, profiles!inner(id, display_name, handle)")
        .eq("group_id", groupId);
      if (gmError) throw new Error(gmError.message);

      // 2. Beendete Runden für diese Gruppe abrufen
      const { data: rounds, error: rError } = await sb
        .from("rounds")
        .select("id")
        .eq("group_id", groupId)
        .eq("status", "finished");
      if (rError) throw new Error(rError.message);

      const roundIds = (rounds ?? []).map((r) => r.id);

      // 3. Nur Strafen abrufen, die exakt group_id = groupId haben und zu beendeten Gruppenrunden gehören
      // Strafen mit group_id IS NULL (z.B. aus privaten Runden) werden strikt ausgeschlossen
      let penalties: {
        round_player_id: string;
        amount: number;
        group_id: string | null;
        round_players: {
          profile_id: string | null;
          guest_name: string | null;
          profiles: { id: string; display_name: string; handle: string } | null;
        } | null;
      }[] = [];

      if (roundIds.length > 0) {
        const { data: penData, error: penError } = await sb
          .from("penalties")
          .select("round_player_id, amount, group_id, round_players(profile_id, guest_name, profiles(id, display_name, handle))")
          .eq("group_id", groupId)
          .in("round_id", roundIds);
        if (penError) throw new Error(penError.message);
        penalties = (penData ?? []) as unknown as typeof penalties;
      }

      // Map aller Gruppenmitglieder initialisieren (auch 0 Euro Beträge abbilden)
      const profileMap = new Map<string, { id: string; name: string; handle: string; euro: number }>();

      for (const m of members ?? []) {
        const p = m.profiles as unknown as { id: string; display_name: string; handle: string } | null;
        if (p) {
          profileMap.set(p.id, {
            id: p.id,
            name: p.display_name || p.handle || "Unbekannt",
            handle: p.handle || "",
            euro: 0,
          });
        }
      }

      // Strafen mit group_id = groupId summieren
      for (const pen of penalties) {
        const rp = pen.round_players;
        if (rp?.profile_id) {
          if (!profileMap.has(rp.profile_id)) {
            const p = rp.profiles;
            profileMap.set(rp.profile_id, {
              id: rp.profile_id,
              name: p?.display_name || rp.guest_name || "Unbekannt",
              handle: p?.handle || "",
              euro: 0,
            });
          }
          const entry = profileMap.get(rp.profile_id)!;
          entry.euro += Number(pen.amount ?? 0);
        }
      }

      return Array.from(profileMap.values())
        .map((r) => ({
          ...r,
          euro: Math.round(r.euro * 100) / 100,
        }))
        .sort((a, b) => b.euro - a.euro || a.name.localeCompare(b.name, "de"));
    }

    const { data: rpcData, error } = await context.supabase.rpc("penalty_hall_of_shame");
    if (error) throw new Error(error.message);
    return ((rpcData ?? []) as {
      profile_id: string;
      display_name: string;
      handle: string;
      total_amount: number | string;
    }[])
      .map((r) => ({
        id: r.profile_id,
        name: r.display_name,
        handle: r.handle,
        euro: Number(r.total_amount ?? 0),
      }))
      .sort((a, b) => b.euro - a.euro);
  });

export const getStatsOverview = getHallOfShame;
