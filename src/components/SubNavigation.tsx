import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SubNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function SubNavigation({
  items,
  value,
  onChange,
}: {
  items: SubNavItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Unternavigation"
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
    >
      <div
        className="mx-auto grid h-13 max-w-lg px-3"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              <span className="truncate text-[11px] font-bold">{label}</span>
              <span
                className={cn(
                  "absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity",
                  active ? "bg-primary opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function SlideViews({
  index,
  children,
}: {
  index: number;
  children: ReactNode[];
}) {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = refs.current[index];
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, children]);

  const [enableTransition, setEnableTransition] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnableTransition(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={cn("overflow-hidden", enableTransition && "transition-[height] duration-300 ease-out")}
      style={{ height }}
    >
      <div
        className={cn("flex w-full items-start", enableTransition && "transition-transform duration-300 ease-out")}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-hidden={i !== index}
            className={cn("w-full shrink-0", i !== index && "pointer-events-none")}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
