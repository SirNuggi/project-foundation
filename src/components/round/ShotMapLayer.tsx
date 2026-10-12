import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Tooltip as LeafletTooltip } from "leaflet";
import { CircleMarker, Polyline, Tooltip, useMapEvents } from "react-leaflet";
import { getHoleShots, getRoundShots } from "@/lib/shots.functions";
import { placeShotLabels } from "@/components/round/shotLabelLayout";
import type { ShotLog } from "@/lib/shots";

interface ShotMapLayerProps {
  roundId: string;
  holeNumber: number;
  userId: string;
  showAll: boolean;
  targetLine?: [[number, number], [number, number]] | undefined;
}

export function ShotMapLayer({ roundId, holeNumber, userId, showAll, targetLine }: ShotMapLayerProps) {
  const map = useMapEvents({
    zoomend() { setShowLabels(map.getZoom() >= 16); },
  });
  const [showLabels, setShowLabels] = useState(() => map.getZoom() >= 16);
  const tooltips = useRef(new Map<string, LeafletTooltip>());
  const fetchShots = useServerFn(getHoleShots);
  const fetchRoundShots = useServerFn(getRoundShots);
  const { data: shots = [] } = useQuery({
    queryKey: showAll ? ["round-shots", roundId, userId] : ["hole-shots", roundId, userId, holeNumber],
    queryFn: () => showAll ? fetchRoundShots({ data: { roundId } }) : fetchShots({ data: { roundId, holeNumber } }),
  });
  const holes = new Map<number, ShotLog[]>();
  shots.forEach((shot) => {
    const hole = holes.get(shot.hole_number) ?? [];
    hole.push(shot);
    holes.set(shot.hole_number, hole);
  });

  useEffect(() => {
    if (!showLabels) return;
    let frame = 0;
    const layout = () => {
      const labels = shots.map((shot) => tooltips.current.get(shot.id));
      if (labels.some((label) => !label?.getElement())) return;
      const points = shots.map((shot) => map.latLngToContainerPoint([shot.latitude, shot.longitude]));
      const sizes = labels.map((label) => {
        const element = label!.getElement()!;
        return { width: element.offsetWidth, height: element.offsetHeight };
      });
      const lines: [typeof points[number], typeof points[number]][] = [];
      points.slice(1).forEach((point, index) => {
        if (shots[index]!.hole_number === shots[index + 1]!.hole_number) lines.push([points[index]!, point]);
      });
      if (targetLine) {
        lines.push([map.latLngToContainerPoint(targetLine[0]), map.latLngToContainerPoint(targetLine[1])]);
      }
      const placements = placeShotLabels(points, sizes, lines, map.getSize());
      labels.forEach((label, index) => {
        const placement = placements[index]!;
        const shot = shots[index]!;
        label!.options.direction = placement.direction;
        label!.options.offset = placement.offset;
        label!.setLatLng([shot.latitude, shot.longitude]);
      });
    };
    const scheduleLayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    scheduleLayout();
    map.on("move zoomend rotate resize", scheduleLayout);
    return () => {
      cancelAnimationFrame(frame);
      map.off("move zoomend rotate resize", scheduleLayout);
    };
  }, [map, shots, targetLine, showLabels]);

  return (
    <>
      {Array.from(holes, ([hole, holeShots]) => holeShots.length > 1 && (
        <Polyline
          key={hole}
          positions={holeShots.map((shot) => [shot.latitude, shot.longitude] as [number, number])}
          interactive={false}
          pathOptions={{ color: "#22c55e", weight: 2, opacity: 0.65, lineCap: "round", lineJoin: "round" }}
        />
      ))}
      {shots.map((shot, index) => {
        const next = shots[index + 1];
        const distance = next?.hole_number === shot.hole_number ? next.distance_meters : null;
        const label = `${shot.club_code}${distance != null ? `:${Math.round(distance)}m` : ""}`;
        return (
          <CircleMarker
            key={shot.id}
            center={[shot.latitude, shot.longitude]}
            radius={5}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }}
          >
            {showLabels && (
              <Tooltip
                ref={(tooltip) => {
                  if (tooltip) tooltips.current.set(shot.id, tooltip);
                  else tooltips.current.delete(shot.id);
                }}
                permanent
                direction="right"
                offset={[10, 0]}
                opacity={1}
                className="m-0! rounded! border-green-800/30! px-1! py-0.5! text-[10px]! leading-3! shadow-none! before:hidden!"
              >
                <span
                  className="font-bold text-green-800"
                  aria-label={`Loch ${shot.hole_number}, Schlag ${shot.shot_number}: ${shot.club_name ?? shot.club_code}${distance != null ? `, ${Math.round(distance)} Meter` : ", Distanz noch offen"}`}
                >
                  {label}
                </span>
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}
