import { stablefordPoints, strokesPerHole } from "./stableford";

export type GolfStatsRound = {
  playerId: string;
  profileId: string;
  roundId: string;
  status: string;
  playedOn: string;
  courseName: string;
  holeCount: number;
  /** Playing handicap for the round (sign ignored); null = no handicap known. */
  playingHandicap?: number | null;
  /** Stroke index per played hole number. */
  strokeIndexes?: Record<number, number> | undefined;
};

export type GolfStatsScore = {
  round_player_id: string;
  hole_number: number;
  par: number;
  strokes: number | null;
  putts: number | null;
  tee_direction: string | null;
};

export function calculateGolfStatistics(userId: string, rounds: GolfStatsRound[], scores: GolfStatsScore[]) {
  const ownRounds = rounds.filter((round) => round.profileId === userId && round.status === "finished");
  const roundByPlayer = new Map(ownRounds.map((round) => [round.playerId, round]));
  let girHits = 0;
  let girHoles = 0;
  let totalPutts = 0;
  let puttingHoles = 0;
  const directions = { left: 0, hit: 0, right: 0, short: 0 };
  const puttingByRound = new Map<string, { putts: number; holes: number }>();
  const distribution = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
  const byPar: Record<3 | 4 | 5, { strokes: number; holes: number }> = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };
  const pointsByRound = new Map<string, { points: number; holes: number }>();
  const extraByRound = new Map<string, Record<number, number>>();
  for (const round of ownRounds) {
    if (round.playingHandicap === null || round.playingHandicap === undefined || !round.strokeIndexes) continue;
    const holes = Array.from({ length: round.holeCount }, (_, i) => ({ holeNumber: i + 1, par: 4, strokeIndex: round.strokeIndexes?.[i + 1] ?? i + 1 }));
    extraByRound.set(round.roundId, strokesPerHole(holes, round.playingHandicap));
  }

  for (const score of scores) {
    const round = roundByPlayer.get(score.round_player_id);
    if (!round || score.hole_number < 1 || score.hole_number > round.holeCount || score.strokes === null || score.strokes < 1) continue;
    const diff = score.strokes - score.par;
    if (diff <= -2) distribution.eagle += 1;
    else if (diff === -1) distribution.birdie += 1;
    else if (diff === 0) distribution.par += 1;
    else if (diff === 1) distribution.bogey += 1;
    else distribution.double += 1;
    if (score.par === 3 || score.par === 4 || score.par === 5) {
      byPar[score.par].strokes += score.strokes;
      byPar[score.par].holes += 1;
    }
    const extra = extraByRound.get(round.roundId);
    if (extra) {
      const entry = pointsByRound.get(round.roundId) ?? { points: 0, holes: 0 };
      entry.points += stablefordPoints(score.par + (extra[score.hole_number] ?? 0), score.strokes);
      entry.holes += 1;
      pointsByRound.set(round.roundId, entry);
    }
    const validPutts = score.putts !== null && score.putts >= 0 && score.putts <= score.strokes;
    if (validPutts && score.putts !== null) {
      totalPutts += score.putts;
      puttingHoles += 1;
      const putting = puttingByRound.get(round.roundId) ?? { putts: 0, holes: 0 };
      putting.putts += score.putts;
      putting.holes += 1;
      puttingByRound.set(round.roundId, putting);
      if (score.par >= 3 && score.par <= 6) {
        girHoles += 1;
        if (score.strokes - score.putts <= score.par - 2) girHits += 1;
      }
    }
    if (score.par >= 4 && score.tee_direction && Object.hasOwn(directions, score.tee_direction)) {
      directions[score.tee_direction as keyof typeof directions] += 1;
    }
  }

  const drivingHoles = Object.values(directions).reduce((sum, count) => sum + count, 0);
  const trend = ownRounds
    .filter((round) => puttingByRound.has(round.roundId))
    .sort((a, b) => a.playedOn.localeCompare(b.playedOn) || a.roundId.localeCompare(b.roundId))
    .map((round) => {
      const putting = puttingByRound.get(round.roundId);
      return {
        roundId: round.roundId,
        playedOn: round.playedOn,
        courseName: round.courseName,
        holes: putting?.holes ?? 0,
        average: putting ? putting.putts / putting.holes : 0,
      };
    })
    .slice(-12);

  // Only fully played rounds give a comparable Stableford total.
  const stableford = ownRounds
    .filter((round) => pointsByRound.get(round.roundId)?.holes === round.holeCount)
    .sort((a, b) => a.playedOn.localeCompare(b.playedOn) || a.roundId.localeCompare(b.roundId))
    .map((round) => ({ roundId: round.roundId, playedOn: round.playedOn, courseName: round.courseName, holes: round.holeCount, points: pointsByRound.get(round.roundId)?.points ?? 0 }));
  const best18 = stableford.filter((r) => r.holes === 18).reduce<(typeof stableford)[number] | null>((best, r) => (!best || r.points > best.points ? r : best), null);
  const recent = stableford.slice(-12);
  const scoredHoles = Object.values(distribution).reduce((a, b) => a + b, 0);

  return {
    scoredHoles,
    distribution,
    parScoring: ([3, 4, 5] as const).map((par) => ({ par, holes: byPar[par].holes, average: byPar[par].holes ? byPar[par].strokes / byPar[par].holes : null })),
    stablefordTrend: recent,
    stablefordBest: best18,
    stablefordAverage: recent.length ? recent.reduce((s, r) => s + r.points, 0) / recent.length : null,
    girHits,
    girHoles,
    girPercent: girHoles ? (girHits / girHoles) * 100 : null,
    drivingHoles,
    directions,
    puttingHoles,
    averagePutts: puttingHoles ? totalPutts / puttingHoles : null,
    trend,
  };
}

export type GolfStatistics = ReturnType<typeof calculateGolfStatistics>;