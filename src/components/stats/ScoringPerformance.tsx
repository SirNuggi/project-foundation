import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { BarChart3, PieChart as PieIcon, Trophy } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { GolfStatistics } from "@/lib/golf-statistics";

const decimal = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });

const buckets = [
  { key: "eagle", label: "Eagle+", color: "var(--chart-4)" },
  { key: "birdie", label: "Birdie", color: "var(--primary)" },
  { key: "par", label: "Par", color: "var(--chart-2)" },
  { key: "bogey", label: "Bogey", color: "var(--chart-3)" },
  { key: "double", label: "Doppel+", color: "var(--destructive)" },
] as const;

export function ScoringPerformance({ stats }: { stats: GolfStatistics }) {
  const fillId = `stb-${useId().replace(/:/g, "")}`;
  const donut = buckets.map((b) => ({ ...b, value: stats.distribution[b.key] })).filter((b) => b.value > 0);
  const maxAvg = Math.max(6, ...stats.parScoring.map((p) => p.average ?? 0));

  return (
    <section className="px-6 pt-8" aria-labelledby="scoring-title">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="scoring-title" className="text-sm font-black uppercase">Scoring</h2>
        <span className="text-xs text-muted-foreground">Beendete Runden</span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <article className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-black"><PieIcon className="h-4 w-4 text-primary" />Score-Verteilung</h3>
          {stats.scoredHoles ? (
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-32 w-32 shrink-0">
                <ChartContainer config={{}} className="h-32 w-32 aspect-square">
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="label" innerRadius={42} outerRadius={60} strokeWidth={2} stroke="var(--card)" isAnimationActive={false}>
                      {donut.map((d) => <Cell key={d.key} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black tabular-nums">{stats.scoredHoles}</span>
                  <span className="text-[10px] text-muted-foreground">Löcher</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {buckets.map((b) => {
                  const count = stats.distribution[b.key];
                  return (
                    <li key={b.key} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
                      <span className="flex-1 text-muted-foreground">{b.label}</span>
                      <span className="font-bold tabular-nums">{Math.round((count / stats.scoredHoles) * 100)} %</span>
                      <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p className="mt-3 text-xs text-muted-foreground">Noch keine Scores</p>}
        </article>

        <article className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-black"><BarChart3 className="h-4 w-4 text-primary" />Scoring nach Par</h3>
          <div className="mt-3 space-y-3">
            {stats.parScoring.map((p) => (
              <div key={p.par}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">Par {p.par} · {p.holes} Löcher</span>
                  <span className="tabular-nums">
                    <span className="text-base font-black">{p.average === null ? "—" : decimal.format(p.average)}</span>
                    {p.average !== null && <span className="ml-1.5 font-bold text-muted-foreground">{p.average - p.par >= 0 ? "+" : ""}{decimal.format(p.average - p.par)}</span>}
                  </span>
                </div>
                <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${((p.average ?? 0) / maxAvg) * 100}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${(p.par / maxAvg) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">Strich = Par</p>
        </article>

        <article className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-black">Netto-Stableford</h3>
              <p className="mt-1 text-xs text-muted-foreground">Trend · letzte 12 Runden</p>
            </div>
            {stats.stablefordBest && (
              <div className="flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                <span className="font-black tabular-nums">{stats.stablefordBest.points} Pkt</span>
                <span className="max-w-28 truncate text-muted-foreground">{stats.stablefordBest.courseName}</span>
              </div>
            )}
          </div>
          {stats.stablefordTrend.length ? (
            <ChartContainer config={{ points: { label: "Punkte", color: "var(--primary)" } }} className="mt-3 h-40 w-full">
              <AreaChart data={stats.stablefordTrend} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
                <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis dataKey="playedOn" tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={35} tickMargin={8} />
                <YAxis hide domain={[0, (max: number) => Math.max(40, max + 2)]} />
                <ReferenceLine y={36} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "36", position: "insideTopLeft", fill: "var(--muted-foreground)", fontSize: 10 }} />
                <ChartTooltip content={({ active, payload }) => {
                  const pt = payload?.[0]?.payload as GolfStatistics["stablefordTrend"][number] | undefined;
                  if (!active || !pt) return null;
                  return <div className="max-w-52 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground"><p className="font-bold">{pt.courseName}</p><p className="mt-1 text-muted-foreground">{dateLabel(pt.playedOn)} · {pt.holes} Löcher</p><p className="mt-2 font-bold">{pt.points} Punkte</p></div>;
                }} />
                <Area type="monotone" dataKey="points" stroke="var(--primary)" strokeWidth={3} fill={`url(#${fillId})`} dot={{ r: 3, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          ) : <div className="mt-3 flex h-40 items-center justify-center border-b border-dashed border-border text-xs text-muted-foreground">Noch keine vollständigen Runden mit Handicap</div>}
          <p className="mt-2 text-right text-xs text-muted-foreground">Ø {stats.stablefordAverage === null ? "—" : decimal.format(stats.stablefordAverage)} Pkt</p>
        </article>
      </div>
    </section>
  );
}
