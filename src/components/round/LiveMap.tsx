import { useEffect, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";

const meIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-50%)">
    <div style="width:22px;height:22px;border-radius:9999px;background:#00E05A;border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,224,90,0.35),0 2px 6px rgba(0,0,0,0.4)"></div>
    <div style="margin-top:4px;background:#111;color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:9999px;white-space:nowrap">Ich</div>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function targetIcon(distanceText: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-50%)">
      <div style="width:18px;height:18px;border-radius:9999px;background:#111;border:3px solid #00E05A;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>
      <div style="margin-top:4px;background:#00E05A;color:#111;font-size:12px;font-weight:800;padding:2px 8px;border-radius:9999px;white-space:nowrap">${distanceText}</div>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const FALLBACK_CENTER: [number, number] = [47.5, 13.5];

function FollowPosition({ position }: { position: [number, number] }) {
  const map = useMap();
  const [firstFix, setFirstFix] = useState(true);
  useEffect(() => {
    if (firstFix) {
      map.setView(position, 17);
      setFirstFix(false);
    } else {
      map.panTo(position, { animate: true });
    }
  }, [position, map, firstFix]);
  return null;
}

const LINE_GAP_PX = 26;

function DistanceLine({ from, to }: { from: [number, number]; to: [number, number] }) {
  const map = useMap();
  const [points, setPoints] = useState<[number, number][] | null>(null);

  useEffect(() => {
    const update = () => {
      const zoom = map.getZoom();
      const p1 = map.project(L.latLng(from[0], from[1]), zoom);
      const p2 = map.project(L.latLng(to[0], to[1]), zoom);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < LINE_GAP_PX * 2 + 8) {
        setPoints(null);
        return;
      }
      const s1 = map.unproject(L.point(p1.x + (dx / dist) * LINE_GAP_PX, p1.y + (dy / dist) * LINE_GAP_PX), zoom);
      const s2 = map.unproject(L.point(p2.x - (dx / dist) * LINE_GAP_PX, p2.y - (dy / dist) * LINE_GAP_PX), zoom);
      setPoints([
        [s1.lat, s1.lng],
        [s2.lat, s2.lng],
      ]);
    };
    update();
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [from[0], from[1], to[0], to[1], map]);

  if (!points) return null;
  return <Polyline positions={points} pathOptions={{ color: "#00E05A", weight: 2, dashArray: "6 8" }} />;
}

function TargetPicker({ onPick }: { onPick: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2).replace(".", ",")} km`;
  return `${Math.round(meters)} m`;
}

export default function LiveMap() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [target, setTarget] = useState<[number, number] | null>(null);

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
        center={position ?? FALLBACK_CENTER}
        zoom={position ? 17 : 13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TargetPicker onPick={setTarget} />
        {position && (
          <>
            <FollowPosition position={position} />
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
            {position && <DistanceLine from={position} to={target} />}
          </>
        )}
      </MapContainer>

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
