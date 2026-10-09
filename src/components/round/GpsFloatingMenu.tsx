import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const POS_KEY = "gps-menu-pos";

export function GpsFloatingMenu({
  mapVisible,
  onToggleMap,
  opacity,
  onOpacityChange,
}: {
  mapVisible: boolean;
  onToggleMap: () => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const clamp = (x: number, y: number) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 120;
    const h = el?.offsetHeight ?? 56;
    return {
      x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    };
  };

  useEffect(() => {
    let initial = { x: window.innerWidth - 140, y: window.innerHeight - 180 };
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) initial = JSON.parse(saved);
    } catch {}
    setPos(clamp(initial.x, initial.y));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.moved = true;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  };
  const onPointerUp = () => {
    if (drag.current?.moved && pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
    drag.current = null;
  };

  if (!pos) return null;

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      className="fixed z-50 flex items-center gap-1 rounded-full border border-border bg-secondary p-1.5 text-secondary-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Menü verschieben"
        className="flex h-11 w-5 cursor-grab flex-col items-center justify-center gap-1 active:cursor-grabbing"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1 w-1 rounded-full bg-secondary-foreground/50" />
        ))}
      </div>
      <button
        type="button"
        aria-label={mapVisible ? "Karte ausblenden" : "Karte einblenden"}
        onClick={onToggleMap}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          mapVisible ? "bg-primary text-primary-foreground" : "bg-sidebar-accent",
        )}
      >
        <MapIcon className="h-5 w-5" />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Karteneinstellungen"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-sidebar-accent"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="z-[1100] w-60">
          <div className="mb-3 flex items-center justify-between text-sm font-bold">
            <span>Deckkraft der Karte</span>
            <span className="text-muted-foreground">{Math.round(opacity * 100)} %</span>
          </div>
          <Slider
            min={30}
            max={100}
            step={1}
            value={[Math.round(opacity * 100)]}
            onValueChange={(v) => onOpacityChange((v[0] ?? 85) / 100)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
