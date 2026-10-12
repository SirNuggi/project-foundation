import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Tooltip as LeafletTooltip } from "leaflet";
import { CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import { getHoleShots } from "@/lib/shots.functions";
import { placeShotLabels } from "@/components/round/shotLabelLayout";

interface ShotMapLayerProps {
  roundId: string;
  holeNumber: number;
  userId: string;
  targetLine?: [[number, number], [number, number]] | undefined;
}

export function ShotMapLayer({ roundId, holeNumber, userId, targetLine }: ShotMapLayerProps) {
  const map = useMap();
  const tooltips = useRef(new Map<string, LeafletTooltip>());
  const fetchShots = useServerFn(getHoleShots);
  const { data: shots = [] } = useQuery({
    queryKey: ["hole-shots", roundId, userId, holeNumber],
    queryFn: () => fetchShots({ data: { roundId, holeNumber } }),
  });
  const positions: [number, number][] = shots.map((shot) => [shot.latitude, shot.longitude]);

  useEffect(() => {
    let frame = 0;
    const layout = () => {
      const labels = shots.map((shot) => tooltips.current.get(shot.id));
      if (labels.some((label) => !label?.getElement())) return;
      const points = shots.map((shot) => map.latLngToContainerPoint([shot.latitude, shot.longitude]));
      const sizes = labels.map((label) => {
        const element = label!.getElement()!;
        return { width: element.offsetWidth, height: element.offsetHeight };
      });
      const lines: [typeof points[number], typeof points[number]][] = points.slice(1).map((point, index) => [points[index]!, point]);
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
  }, [map, shots, targetLine]);

  return (
    <>
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          interactive={false}
          pathOptions={{ color: "#22c55e", weight: 2, opacity: 0.65, lineCap: "round", lineJoin: "round" }}
        />
      )}
      {shots.map((shot, index) => {
        const distance = shots[index + 1]?.distance_meters;
        const label = `${shot.club_code}${distance != null ? `:${Math.round(distance)}m` : ""}`;
        return (
          <CircleMarker
            key={shot.id}
            center={[shot.latitude, shot.longitude]}
            radius={5}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }}
          >
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
                aria-label={`Schlag ${shot.shot_number}: ${shot.club_name ?? shot.club_code}${distance != null ? `, ${Math.round(distance)} Meter` : ", Distanz noch offen"}`}
              >
                {label}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
