import { useEffect, useRef, useState } from "react";
import { Compass, Crosshair } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHoleShots } from "@/lib/shots.functions";
import L from "leaflet";
import "leaflet-rotate";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ShotMapLayer } from "@/components/round/ShotMapLayer";

const meIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="box-sizing:border-box;width:22px;height:22px;border-radius:9999px;background:#00E05A;border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,224,90,0.35),0 2px 6px rgba(0,0,0,0.4)"></div>
    <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:9999px;white-space:nowrap">Ich</div>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function targetIcon(distanceText: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:18px;height:18px">
      <div style="box-sizing:border-box;width:18px;height:18px;border-radius:9999px;background:#111;border:3px solid #00E05A;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>
      <div style="position:absolute;top:24px;left:50%;transform:translateX(-50%);background:#00E05A;color:#111;font-size:12px;font-weight:800;padding:2px 8px;border-radius:9999px;white-space:nowrap">${distanceText}</div>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const FALLBACK_CENTER: [number, number] = [47.5, 13.5];

function InitialPosition({ position, skip }: { position: [number, number]; skip: boolean }) {
  const map = useMap();
  const [firstFix, setFirstFix] = useState(true);
  useEffect(() => {
    if (!firstFix || skip) return;
    map.setView(position, 17);
    setFirstFix(false);
  }, [position, map, firstFix]);
  return null;
}


function HoleFocus({ roundId, holeNumber, userId, trigger, auto }: {
  roundId: string; holeNumber: number; userId: string; trigger: number; auto: boolean;
}) {
  const map = useMap();
  const fetchShots = useServerFn(getHoleShots);
  const { data: shots } = useQuery({
    queryKey: ["hole-shots", roundId, userId, holeNumber],
    queryFn: () => fetchShots({ data: { roundId, holeNumber } }),
  });
  const autoDone = useRef<number | null>(null);
  useEffect(() => {
    if (!shots?.length) return;
    const isAuto = auto && autoDone.current !== holeNumber;
    if (!isAuto && trigger === 0) return;
    autoDone.current = holeNumber;
    const first = shots[0]!;
    const last = shots[shots.length - 1]!;
    if (shots.length === 1) {
      map.setBearing(0);
      map.setView([first.latitude, first.longitude], 18);
      return;
    }
    // Kompassrichtung vom ersten zum letzten Schlag zeigt nach oben.
    const r = Math.PI / 180;
    const y = Math.sin((last.longitude - first.longitude) * r) * Math.cos(last.latitude * r);
    const x = Math.cos(first.latitude * r) * Math.sin(last.latitude * r)
      - Math.sin(first.latitude * r) * Math.cos(last.latitude * r) * Math.cos((last.longitude - first.longitude) * r);
    const heading = Math.atan2(y, x) / r;
    map.setBearing(-heading);
    map.fitBounds(L.latLngBounds(shots.map((s) => [s.latitude, s.longitude] as [number, number])), {
      padding: [50, 50], maxZoom: 19,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, trigger, auto, holeNumber, map]);
  return null;
}

function TargetPicker({ onPick }: { onPick: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function BearingTracker({ onChange }: { onChange: (bearing: number) => void }) {
  const map = useMapEvents({
    rotate() {
      onChange(map.getBearing());
    },
  });
  return null;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2).replace(".", ",")} km`;
  return `${Math.round(meters)} m`;
}

interface LiveMapProps {
  roundId: string;
  holeNumber: number;
  userId: string | null;
  finished?: boolean;
}

export default function LiveMap({ roundId, holeNumber, userId, finished = false }: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [target, setTarget] = useState<[number, number] | null>(null);
  const [bearing, setBearing] = useState(0);
  const [focusTrigger, setFocusTrigger] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy ?? null);
        setDenied(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const distance =
    position && target ? L.latLng(position[0], position[1]).distanceTo(L.latLng(target[0], target[1])) : null;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        ref={mapRef}
        center={position ?? FALLBACK_CENTER}
        zoom={position ? 17 : 13}
        className="h-full w-full"
        zoomControl={false}
        rotate
        touchRotate
        rotateControl={false}
        bearing={0}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BearingTracker onChange={setBearing} />
        <TargetPicker onPick={setTarget} />
        {userId && <ShotMapLayer roundId={roundId} holeNumber={holeNumber} userId={userId} />}
        {userId && (
          <HoleFocus roundId={roundId} holeNumber={holeNumber} userId={userId} trigger={focusTrigger} auto={finished} />
        )}
        {position && (
          <>
            <InitialPosition position={position} skip={finished} />
            <Marker position={position} icon={meIcon} />
            {accuracy !== null && (
              <Circle
                center={position}
                radius={accuracy}
                pathOptions={{ color: "#00E05A", weight: 1, fillOpacity: 0.1 }}
              />
            )}
          </>
        )}
        {target && (
          <>
            <Marker
              position={target}
              icon={targetIcon(distance !== null ? formatDistance(distance) : "Ziel")}
            />
            {position && (
              <Polyline
                positions={[position, target]}
                pathOptions={{ color: "#00E05A", weight: 2, dashArray: "6 8" }}
              />
            )}
          </>
        )}
      </MapContainer>

      {userId && (
        <button
          type="button"
          aria-label="Auf Schläge des Lochs zoomen und ausrichten"
          title="Auf Loch ausrichten"
          onClick={() => setFocusTrigger((n) => n + 1)}
          className="absolute right-4 top-[4.25rem] z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg"
        >
          <Crosshair className="h-5 w-5" />
        </button>
      )}

      {Math.abs(bearing) > 0.5 && (
        <button
          type="button"
          aria-label="Karte nach Norden ausrichten"
          onClick={() => {
            const map = mapRef.current;
            if (map) map.setBearing(0);
          }}
          className="absolute right-4 top-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg"
        >
          <Compass className="h-5 w-5" style={{ transform: `rotate(${-bearing}deg)` }} />
        </button>
      )}

      {target && (
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-lg"
        >
          Marker entfernen
        </button>
      )}

      {denied && (
        <div className="absolute inset-x-4 top-4 z-[1000] rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground shadow-lg">
          Standort nicht freigegeben — dein Punkt kann nicht angezeigt werden. Du kannst die Karte
          trotzdem nutzen.
        </div>
      )}
      {!position && !denied && (
        <div className="absolute inset-x-4 top-4 z-[1000] rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground shadow-lg">
          Suche deine Position …
        </div>
      )}
      {!target && !denied && position && (
        <div className="absolute inset-x-4 bottom-6 z-[1000] rounded-2xl bg-secondary px-4 py-3 text-center text-sm font-bold text-secondary-foreground shadow-lg">
          Tippe auf die Karte, um einen Ziel-Marker zu setzen.
        </div>
      )}
    </div>
  );
}
