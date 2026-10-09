import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { calculateGolfStatistics, type GolfStatsRound, type GolfStatsScore } from "./golf-statistics";

const round: GolfStatsRound = { playerId: "p", profileId: "me", roundId: "r", status: "finished", playedOn: "2026-10-08", courseName: "Testplatz", holeCount: 18 };
const score: GolfStatsScore = { round_player_id: "p", hole_number: 1, par: 4, strokes: 4, putts: 2, tee_direction: "hit" };

describe("Personal golf statistics", () => {
  test("GIR uses strokes minus putts against hole par minus two", () => {
    const result = calculateGolfStatistics("me", [round], [score, { ...score, hole_number: 2, strokes: 5 }, { ...score, hole_number: 3, par: 3, strokes: 3 }, { ...score, hole_number: 4, par: 5, strokes: 5 }]);
    assert.equal(result.girHits, 3);
    assert.equal(result.girPercent, 75);
  });
  test("Only finished rounds count", () => {
    assert.equal(calculateGolfStatistics("me", [{ ...round, status: "open" }], [score]).girHoles, 0);
  });
  test("Other players do not count", () => {
    assert.equal(calculateGolfStatistics("me", [{ ...round, profileId: "other" }], [score]).puttingHoles, 0);
  });
  test("Unknown putts and missing strokes are excluded rather than counted as zero", () => {
    const result = calculateGolfStatistics("me", [round], [{ ...score, putts: null }, { ...score, strokes: 0 }]);
    assert.equal(result.girPercent, null);
    assert.equal(result.averagePutts, null);
  });
  test("Zero putts are valid; putts exceeding strokes are not", () => {
    const result = calculateGolfStatistics("me", [round], [{ ...score, putts: 0, strokes: 2 }, { ...score, hole_number: 2, putts: 5 }]);
    assert.equal(result.puttingHoles, 1);
    assert.equal(result.averagePutts, 0);
    assert.equal(result.girPercent, 100);
  });
  test("Driving counts recorded directions on par four or higher, including short misses", () => {
    const result = calculateGolfStatistics("me", [round], [score, { ...score, hole_number: 2, par: 3, tee_direction: "left" }, { ...score, hole_number: 3, tee_direction: null }, { ...score, hole_number: 4, tee_direction: "short" }]);
    assert.equal(result.drivingHoles, 2);
    assert.deepEqual(result.directions, { left: 0, hit: 1, right: 0, short: 1 });
  });
  test("Putts average is weighted by holes, so nine and eighteen holes remain comparable", () => {
    const result = calculateGolfStatistics("me", [round, { ...round, playerId: "p2", roundId: "r2", holeCount: 9, playedOn: "2026-10-01" }], [score, { ...score, hole_number: 2, putts: 1 }, { ...score, round_player_id: "p2", putts: 3 }]);
    assert.equal(result.averagePutts, 2);
    assert.deepEqual(result.trend.map((item) => item.average), [3, 1.5]);
  });
  test("Scores beyond the round hole count are ignored", () => {
    assert.equal(calculateGolfStatistics("me", [{ ...round, holeCount: 9 }], [{ ...score, hole_number: 10 }]).puttingHoles, 0);
  });
});