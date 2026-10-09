export type GolfStatsRound = {
  playerId: string;
  profileId: string;
  roundId: string;
  status: string;
  playedOn: string;
  courseName: string;
  holeCount: number;
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

  for (const score of scores) {
    const round = roundByPlayer.get(score.round_player_id);
    if (!round || score.hole_number < 1 || score.hole_number > round.holeCount || score.strokes === null || score.strokes < 1) continue;
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

  return {
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