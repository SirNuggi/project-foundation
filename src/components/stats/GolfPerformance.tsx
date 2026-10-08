import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Crosshair, Flag, MoveUpRight } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { GolfStatistics } from "@/lib/golf-statistics";

const decimal = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (value: number) => `${Math.round(value)} %`;
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });
const chartConfig = { average: { label: "Putts pro Loch", color: "var(--primary)" } };

export function GolfPerformance({ stats }: { stats: GolfStatistics }) {
  const fillId = `putts-${useId().replace(/:/g, "")}`;
  const driving = [
    { key: "left", label: "Links", count: stats.directions.left, className: "bg-destructive" },
    { key: "hit", label: "Mitte", count: stats.directions.hit, className: "bg-primary" },
    { key: "right", label: "Rechts", count: stats.directions.right, className: "bg-chart-4" },
    ...(stats.directions.short ? [{ key: "short", label: "Kurz", count: stats.directions.short, className: "bg-chart-3" }] : []),
  ];

  return (
    <section className="px-6 pt-8" aria-labelledby="golf-performance-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="golf-performance-title" className="text-sm font-black uppercase">Dein Spiel</h2>
        <span className="text-xs text-muted-foreground">Beendete Runden</span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-3">
          <article className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><Flag className="h-4 w-4 shrink-0 text-primary" />GIR <span className="text-xs font-medium text-muted-foreground">Greens in Regulation</span></h3>
            <div className="mt-4 flex items-center gap-3">
              <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="h-3 min-w-0 flex-1 overflow-hidden rounded-full" role="img" aria-label={stats.girPercent === null ? "Keine GIR-Werte" : `${percent(stats.girPercent)} Grüns in Regulation`}>
                <rect width="100" height="12" className="fill-muted" />
                <rect width={stats.girPercent ?? 0} height="12" rx="6" className="fill-primary" />
              </svg>
              <span className="text-2xl font-black tabular-nums">{stats.girPercent === null ? "—" : percent(stats.girPercent)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{stats.girHoles ? `${stats.girHits} von ${stats.girHoles} Grüns` : "Noch keine auswertbaren Scores"}</p>
          </article>

          <article className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><Crosshair className="h-4 w-4 text-primary" />Driving Accuracy</h3>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={stats.drivingHoles ? `Abschlagverteilung auf ${stats.drivingHoles} Löchern` : "Keine Abschlagdaten"}>
              {driving.map((direction) => <div key={direction.key} className={direction.className} style={{ width: `${stats.drivingHoles ? (direction.count / stats.drivingHoles) * 100 : 0}%` }} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {driving.map((direction) => (
                <div key={direction.key} className="flex items-center gap-1.5 text-xs">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${direction.className}`} />
                  <span className="text-muted-foreground">{direction.label}</span>
                  <span className="font-bold tabular-nums">{stats.drivingHoles ? percent((direction.count / stats.drivingHoles) * 100) : "—"}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{stats.drivingHoles ? `${stats.drivingHoles} Abschläge · Par 4 und höher` : "Noch keine Abschlagdaten"}</p>
          </article>
        </div>

        <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-black"><MoveUpRight className="h-4 w-4 text-primary" />Putts pro Loch</h3>
          <p className="mt-1 text-xs text-muted-foreground">Rundentrend · letzte 12 Runden</p>
          {stats.trend.length ? (
            <ChartContainer config={chartConfig} className="mt-3 h-36 w-full flex-none sm:h-40">
              <AreaChart accessibilityLayer data={stats.trend} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
                <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis dataKey="playedOn" tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={35} tickMargin={8} />
                <YAxis hide domain={[0, "auto"]} />
                <ChartTooltip content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as GolfStatistics["trend"][number] | undefined;
                  if (!active || !point) return null;
                  return <div className="max-w-52 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground"><p className="font-bold">{point.courseName}</p><p className="mt-1 text-muted-foreground">{dateLabel(point.playedOn)} · {point.holes} Löcher</p><p className="mt-2 font-bold">{decimal.format(point.average)} Putts pro Loch</p></div>;
                }} />
                <Area type="monotone" dataKey="average" stroke="var(--primary)" strokeWidth={3} fill={`url(#${fillId})`} dot={{ r: 3, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          ) : <div className="mt-3 flex h-36 items-center justify-center border-b border-dashed border-border text-xs text-muted-foreground sm:h-40">Noch keine Putts in beendeten Runden</div>}
          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <p className="text-xs text-muted-foreground">Ø über {stats.puttingHoles} Löcher</p>
            <span className="text-4xl font-black tabular-nums">{stats.averagePutts === null ? "—" : decimal.format(stats.averagePutts)}</span>
          </div>
        </article>
      </div>
    </section>
  );
}