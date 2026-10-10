import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import { getHoleShots } from "@/lib/shots.functions";

interface ShotMapLayerProps {
  roundId: string;
  holeNumber: number;
  userId: string;
}

export function ShotMapLayer({ roundId, holeNumber, userId }: ShotMapLayerProps) {
  const fetchShots = useServerFn(getHoleShots);
  const { data: shots = [] } = useQuery({
    queryKey: ["hole-shots", roundId, userId, holeNumber],
    queryFn: () => fetchShots({ data: { roundId, holeNumber } }),
  });
  const positions: [number, number][] = shots.map((shot) => [shot.latitude, shot.longitude]);

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
            <Tooltip permanent direction="top" offset={[0, -7]} opacity={1}>
              <span
                className="text-xs font-bold text-green-800"
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
