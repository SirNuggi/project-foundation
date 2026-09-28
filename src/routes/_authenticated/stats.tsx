import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, Crown, Flag, MapPin, Trophy } from "lucide-react";
import { getHallOfShame, getMyStats, getUserGroups, type UserGroup } from "@/lib/stats.functions";
import { BottomNavigation } from "@/components/BottomNavigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

const myStatsQuery = () => queryOptions({ queryKey: ["my-stats"], queryFn: () => getMyStats() });
const userGroupsQuery = () =>
  queryOptions({ queryKey: ["user-groups"], queryFn: () => getUserGroups() });
const hallQuery = (groupId?: string) =>
  queryOptions({
    queryKey: ["hall-of-shame", groupId],
    queryFn: () => getHallOfShame({ data: groupId ? { groupId } : undefined }),
  });

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Statistiken — Birdie Battle" },
      {
        name: "description",
        content: "Deine Langzeitstatistiken, die Strafkassen-Rangliste und alle beendeten Runden.",
      },
      { property: "og:title", content: "Statistiken — Birdie Battle" },
      { property: "og:description", content: "Strafkasse, Hall of Shame und deine Rundenhistorie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(myStatsQuery()),
      context.queryClient.ensureQueryData(userGroupsQuery()),
    ]);
    const groups = context.queryClient.getQueryData<UserGroup[]>(["user-groups"]);
    const firstGroup = groups?.[0];
    if (firstGroup) {
      await context.queryClient.ensureQueryData(hallQuery(firstGroup.id));
    }
  },
  errorComponent: ({ error }) => (
    <main role="alert" className="min-h-screen bg-background px-6 py-10">
      <p className="font-bold">Statistiken konnten nicht geladen werden.</p>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Link to="/dashboard" className="mt-6 inline-block text-sm font-semibold text-primary">
        ← Dashboard
      </Link>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen bg-background px-6 py-10">
      <p className="font-bold">Keine Statistiken gefunden.</p>
    </main>
  ),
  pendingComponent: () => (
    <main className="min-h-screen bg-background px-6 py-10 text-sm text-muted-foreground">
      Lade Statistiken…
    </main>
  ),
  component: StatsPage,
});

function StatsPage() {
  const { data: stats } = useSuspenseQuery(myStatsQuery());
  const { data: userGroups } = useSuspenseQuery(userGroupsQuery());

  const hasGroups = userGroups.length > 0;
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    userGroups[0]?.id ?? ""
  );

  const activeGroupId = selectedGroupId || userGroups[0]?.id || "";

  const { data: hall = [], isLoading: isHallLoading } = useQuery(
    hallQuery(activeGroupId || undefined)
  );

  const maxBreakdown = Math.max(1, ...stats.breakdown.map((b) => b.amount));

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="bg-secondary px-6 pb-8 pt-7 text-secondary-foreground">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">GOLF BUDDIES</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Statistiken</h1>
      </header>

      <section className="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-3">
        <StatTile
          icon={<Flag className="h-5 w-5 text-primary" />}
          label="Gespielte Runden"
          value={String(stats.roundCount)}
        />
        <StatTile
          icon={<Coins className="h-5 w-5 text-primary" />}
          label="In die Strafkasse"
          value={eur.format(stats.totalEuro)}
        />
        <StatTile
          icon={<MapPin className="h-5 w-5 text-primary" />}
          label="Lieblingsplatz"
          value={stats.favouriteCourse?.name ?? "—"}
          hint={
            stats.favouriteCourse ? `${stats.favouriteCourse.count}× gespielt` : "Noch keine Runde"
          }
        />
      </section>

      {hasGroups && (
        <section className="px-6 pt-10">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <Trophy className="h-4 w-4 text-primary" /> Hall of Shame
          </h2>

          <div className="mt-3">
            <Select
              value={activeGroupId}
              onValueChange={(val) => setSelectedGroupId(val)}
            >
              <SelectTrigger className="w-full bg-card">
                <SelectValue placeholder="Gruppe auswählen" />
              </SelectTrigger>
              <SelectContent>
                {userGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            {hall.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {isHallLoading ? "Lade..." : "Noch keine Spieler in dieser Gruppe."}
              </p>
            )}
            {hall.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="w-6 text-sm font-bold text-muted-foreground">{i + 1}.</span>
                {i === 0 && p.euro > 0 && <Crown className="h-4 w-4 text-primary" />}
                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                <span className="font-black tabular-nums text-destructive">{eur.format(p.euro)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-6 pt-10">
        <h2 className="text-sm font-black uppercase tracking-widest">Wofür du zahlst</h2>
        {stats.breakdown.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Noch keine Strafen in beendeten Runden. Weiter so!
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {stats.breakdown.map((b) => (
              <div key={b.code}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-bold">
                    {b.count}× {b.label}
                  </span>
                  <span className="font-black tabular-nums">{eur.format(b.amount)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(6, (b.amount / maxBreakdown) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="px-6 pt-10">
        <h2 className="text-sm font-black uppercase tracking-widest">Deine historischen Runden</h2>
        <div className="mt-3 space-y-3">
          {stats.rounds.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Noch keine beendete Runde.
            </p>
          )}
          {stats.rounds.map((r) => (
            <Link
              key={r.id}
              to="/round/$roundId/scorecard"
              params={{ roundId: r.id }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div className="rounded-xl bg-accent p-3">
                <Flag className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.courseName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.playedOn).toLocaleDateString("de-AT")} · {r.holeCount} Löcher
                </p>
              </div>
              <span className="font-black tabular-nums text-destructive">{eur.format(r.euro)}</span>
            </Link>
          ))}
        </div>
      </section>
      <BottomNavigation />
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {icon}
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-2xl font-black tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
