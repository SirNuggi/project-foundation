export type TeeKey = "herren" | "damen";

export type HoleInfo = { holeNumber: number; par: number; strokeIndex: number };

/**
 * Offizielle WHS-Formel. Handicap-Index wird in dieser App negativ geführt
 * (z. B. -24.0), das Ergebnis ist entsprechend ebenfalls negativ.
 */
export type CourseHole = {
  hole_number: number;
  par: number;
  stroke_index: number | null;
  stroke_index_back?: number | null;
};

/**
 * Baut die tatsächlich gespielten Löcher einer Runde.
 * 18-Loch-Runde auf einem 9-Loch-Platz: Par der Löcher 10–18 wird gespiegelt,
 * der Stroke-Index kommt aus stroke_index_back (Fallback: Hinrunden-Index).
 */
export function buildRoundHoles(
  courseHoles: CourseHole[],
  courseHoleCount: number,
  roundHoleCount: number,
): HoleInfo[] {
  const byNumber = new Map<number, CourseHole>();
  for (const h of courseHoles) byNumber.set(h.hole_number, h);
  const nine = courseHoleCount === 9 && roundHoleCount === 18;

  const result: HoleInfo[] = [];
  for (let n = 1; n <= roundHoleCount; n += 1) {
    const mirrored = nine && n > 9;
    const source = byNumber.get(mirrored ? n - 9 : n);
    const fallbackSi = mirrored ? n : n;
    result.push({
      holeNumber: n,
      par: source?.par ?? 4,
      strokeIndex: mirrored
        ? (source?.stroke_index_back ?? source?.stroke_index ?? fallbackSi)
        : (source?.stroke_index ?? fallbackSi),
    });
  }
  return result;
}

/** Bei einer 9-Loch-Runde wird das Course Handicap nach WHS halbiert. */
export function playingHandicap(courseHcp: number, roundHoleCount: number): number {
  return roundHoleCount === 9 ? Math.round(courseHcp / 2) : Math.round(courseHcp);
}

export function courseHandicap(
  handicapIndex: number, // z.B. -17.9
  slope: number,
  cr: number,
  parTotal: number,
): number {
  // Wir rechnen intern positiv und geben das Ergebnis negativ zurück
  const positiveHcp = Math.abs(handicapIndex);
  const resultPositive = positiveHcp * (slope / 113) + (cr - parTotal);

  // Wieder negativ machen für deine App-Logik
  return -Math.round(resultPositive);
}

/** Vorgabeschläge je Loch, verteilt nach Stroke-Index (SI 1 zuerst). */
export function strokesPerHole(holes: HoleInfo[], courseHcp: number): Record<number, number> {
  const result: Record<number, number> = {};
  for (const h of holes) result[h.holeNumber] = 0;
  if (holes.length === 0) return result;

  let remaining = Math.abs(Math.round(courseHcp));
  const order = [...holes].sort((a, b) => a.strokeIndex - b.strokeIndex);
  while (remaining > 0) {
    for (const h of order) {
      if (remaining <= 0) break;
      result[h.holeNumber] = (result[h.holeNumber] ?? 0) + 1;
      remaining -= 1;
    }
  }
  return result;
}

/** Persönliches Par je Loch = Loch-Par + Vorgabeschläge auf diesem Loch. */
export function personalPars(holes: HoleInfo[], courseHcp: number): Record<number, number> {
  const extra = strokesPerHole(holes, courseHcp);
  const result: Record<number, number> = {};
  for (const h of holes) result[h.holeNumber] = h.par + (extra[h.holeNumber] ?? 0);
  return result;
}

/** Netto-Stableford: persönliches Par = 2 Punkte, je Schlag besser +1, je Schlag schlechter -1. */
export function stablefordPoints(personalPar: number, strokes: number): number {
  if (!strokes || strokes <= 0) return 0;
  return Math.max(0, 2 + (personalPar - strokes));
}
