interface Point {
  x: number;
  y: number;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface LabelSize {
  width: number;
  height: number;
}

function overlaps(a: Rect, b: Rect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function crossesRect(start: Point, end: Point, rect: Rect) {
  let min = 0;
  let max = 1;
  const axes: [number, number, number, number][] = [
    [start.x, end.x - start.x, rect.left, rect.right],
    [start.y, end.y - start.y, rect.top, rect.bottom],
  ];
  for (const [origin, delta, low, high] of axes) {
    if (delta === 0) {
      if (origin < low || origin > high) return false;
    } else {
      const a = (low - origin) / delta;
      const b = (high - origin) / delta;
      min = Math.max(min, Math.min(a, b));
      max = Math.min(max, Math.max(a, b));
      if (min > max) return false;
    }
  }
  return true;
}

export function placeShotLabels(
  points: Point[],
  sizes: LabelSize[],
  lines: [Point, Point][],
  viewport: Point,
) {
  const occupied: Rect[] = [];
  return points.map((point, index) => {
    const { width, height } = sizes[index]!;
    const candidates = (["right", "left"] as const).flatMap((direction) =>
      [10, 18, 26].flatMap((gap) =>
        [0, -12, 12, -24, 24].map((dy) => {
          const left = direction === "right" ? point.x + gap : point.x - gap - width;
          const rect = { left, right: left + width, top: point.y + dy - height / 2, bottom: point.y + dy + height / 2 };
          const padded = { left: rect.left - 3, right: rect.right + 3, top: rect.top - 3, bottom: rect.bottom + 3 };
          const overflow = Math.max(0, 4 - rect.left) + Math.max(0, rect.right - viewport.x + 4)
            + Math.max(0, 4 - rect.top) + Math.max(0, rect.bottom - viewport.y + 4);
          const lineCollisions = lines.filter(([start, end]) => crossesRect(start, end, padded)).length;
          const labelCollisions = occupied.filter((other) => overlaps(padded, other)).length;
          const markerCollisions = points.filter((marker) => overlaps(padded, {
            left: marker.x - 7, right: marker.x + 7, top: marker.y - 7, bottom: marker.y + 7,
          })).length;
          return {
            direction,
            offset: [direction === "right" ? gap : -gap, dy] as [number, number],
            rect,
            score: overflow * 10000 + lineCollisions * 1000 + (labelCollisions + markerCollisions) * 500
              + gap - 10 + Math.abs(dy),
          };
        }),
      ),
    );
    const best = candidates.reduce((a, b) => a.score <= b.score ? a : b);
    occupied.push(best.rect);
    return { direction: best.direction, offset: best.offset };
  });
}
