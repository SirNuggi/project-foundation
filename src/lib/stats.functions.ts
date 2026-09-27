import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatsRound = {
  id: string;
  courseName: string;
  playedOn: string;
  holeCount: number;
  euro: number;
};

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
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("penalty_hall_of_shame");
    if (error) throw new Error(error.message);
    return ((data ?? []) as {
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
