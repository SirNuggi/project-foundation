import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const getHallOfShame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string }) => input)
  .handler(async ({ data: inputData, context }) => {
    const groupId = inputData?.groupId;

    if (groupId) {
      const sb = context.supabase;

      // 1. Alle Mitglieder der Gruppe abrufen
      const { data: members, error: gmError } = await sb
        .from("group_members")
        .select("user_id, profiles!inner(id, display_name, handle)")
        .eq("group_id", groupId);
      if (gmError) throw new Error(gmError.message);

      // 2. Alle beendeten Runden dieser Gruppe abrufen
      const { data: rounds, error: rError } = await sb
        .from("rounds")
        .select("id")
        .eq("group_id", groupId)
        .eq("status", "finished");
      if (rError) throw new Error(rError.message);

      const roundIds = (rounds ?? []).map((r) => r.id);

      // 3. Round-Player und Strafen für diese Runden abrufen
      let roundPlayers: {
        id: string;
        profile_id: string | null;
        guest_name: string | null;
        profiles: { id: string; display_name: string; handle: string } | null;
      }[] = [];
      let penalties: { round_player_id: string; amount: number }[] = [];

      if (roundIds.length > 0) {
        const { data: rpData, error: rpError } = await sb
          .from("round_players")
          .select("id, profile_id, guest_name, profiles(id, display_name, handle)")
          .in("round_id", roundIds);
        if (rpError) throw new Error(rpError.message);
        roundPlayers = (rpData ?? []) as unknown as typeof roundPlayers;

        const roundPlayerIds = roundPlayers.map((rp) => rp.id);
        if (roundPlayerIds.length > 0) {
          const { data: penData, error: penError } = await sb
            .from("penalties")
            .select("round_player_id, amount")
            .in("round_player_id", roundPlayerIds);
          if (penError) throw new Error(penError.message);
          penalties = (penData ?? []) as unknown as typeof penalties;
        }
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

      const rpToProfileId = new Map<string, string>();
      for (const rp of roundPlayers) {
        if (rp.profile_id) {
          rpToProfileId.set(rp.id, rp.profile_id);
          if (!profileMap.has(rp.profile_id)) {
            const p = rp.profiles;
            profileMap.set(rp.profile_id, {
              id: rp.profile_id,
              name: p?.display_name || rp.guest_name || "Unbekannt",
              handle: p?.handle || "",
              euro: 0,
            });
          }
        }
      }

      for (const pen of penalties) {
        const profileId = rpToProfileId.get(pen.round_player_id);
        if (profileId && profileMap.has(profileId)) {
          const entry = profileMap.get(profileId)!;
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
