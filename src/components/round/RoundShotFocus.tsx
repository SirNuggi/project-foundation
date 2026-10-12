import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { toast } from "sonner";
import { getRoundShots } from "@/lib/shots.functions";

export function RoundShotFocus({ roundId, userId }: { roundId: string; userId: string }) {
  const map = useMap();
  const focused = useRef(false);
  const fetchShots = useServerFn(getRoundShots);
  const { data: shots, error } = useQuery({
    queryKey: ["round-shots", roundId, userId],
    queryFn: () => fetchShots({ data: { roundId } }),
  });

  useEffect(() => {
    if (focused.current || (!shots && !error)) return;
    focused.current = true;
    if (error) {
      toast.error("Schlagaufzeichnungen konnten nicht geladen werden.");
      return;
    }
    map.setBearing(0);
    if (!shots!.length) {
      toast.info("Für diese Runde sind noch keine Schläge aufgezeichnet.");
      return;
    }
    map.fitBounds(L.latLngBounds(shots!.map((shot) => [shot.latitude, shot.longitude] as [number, number])), {
      paddingTopLeft: [35, 60], paddingBottomRight: [75, 40], maxZoom: 18,
    });
  }, [map, shots, error]);

  return null;
}
