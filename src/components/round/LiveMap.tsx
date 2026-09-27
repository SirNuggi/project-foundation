import { useEffect, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

const meIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-50%)">
    <div style="width:22px;height:22px;border-radius:9999px;background:#00E05A;border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,224,90,0.35),0 2px 6px rgba(0,0,0,0.4)"></div>
    <div style="margin-top:4px;background:#111;color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:9999px;white-space:nowrap">Ich</div>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

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

export default function LiveMap() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);

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
      </MapContainer>

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
    </div>
  );
}
