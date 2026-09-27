import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown, Flag, Plus, Shield } from "lucide-react";
import { getMyProfile, listMyRounds } from "@/lib/golf.functions";
import { Button } from "@/components/ui/button";
import { BottomNavigation } from "@/components/BottomNavigation";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Birdie Battle" },
      {
        name: "description",
        content: "Starte eine neue Golfrunde oder sieh dir deine Statistiken an.",
      },
      { property: "og:title", content: "Dashboard — Birdie Battle" },
      { property: "og:description", content: "Neue Runde starten oder Statistiken ansehen." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchProfile = useServerFn(getMyProfile);
  const fetchRounds = useServerFn(listMyRounds);
  const [openRounds, setOpenRounds] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const { data: rounds, isLoading } = useQuery({
    queryKey: ["my-rounds"],
    queryFn: () => fetchRounds(),
  });

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="relative bg-secondary px-6 pb-8 pt-7 text-secondary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">GOLF BUDDIES</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Servus{me?.profile?.display_name ? `, ${me.profile.display_name}` : ""}!
            </h1>
          </div>
        </div>

        <Link
          to="/round/new"
          aria-label="Neue Runde starten"
          className="absolute -bottom-8 left-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
        >
          <Plus className="h-8 w-8" />
        </Link>
      </header>

      <section className="mt-14 px-6">
        <p className="py-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Letzte Runden
        </p>

        <div className="mt-3 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {!isLoading && (rounds?.length ?? 0) === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Noch keine Runde gespielt. Leg los!
            </p>
          )}
          {(openRounds ? (rounds ?? []) : (rounds ?? []).slice(0, 2)).map((round) => (
            <Link
              key={round.id}
              to="/round/$roundId"
              params={{ roundId: round.id }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div className="rounded-xl bg-accent p-3">
                <Flag className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{round.roundName ?? round.courseName}</p>
                {round.roundName ? (
                  <p className="mt-0.5 truncate text-sm font-semibold">{round.courseName}</p>
                ) : null}
                <div className="mt-1 space-y-0.5">
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(round.playedOn).toLocaleDateString("de-AT")} ·{" "}
                    {new Date(round.createdAt).toLocaleTimeString("de-AT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {round.holeCount} Löcher · {round.playerCount} Spieler · {round.flightCount}{" "}
                    {round.flightCount === 1 ? "Flight" : "Flights"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {round.status === "open" ? "Offen" : "Fertig"}
              </span>
            </Link>
          ))}
        </div>

        {(rounds?.length ?? 0) > 2 && (
          <button
            type="button"
            onClick={() => setOpenRounds((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-1 py-2 text-xs font-semibold text-muted-foreground"
          >
            {openRounds ? "Weniger anzeigen" : "Mehr anzeigen"}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${openRounds ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </section>

      <div className="mt-10 px-6">
        <Button asChild variant="ghost" className="w-full text-muted-foreground">
          <Link to="/admin">
            <Shield className="mr-2 h-4 w-4" /> Admin-Bereich
          </Link>
        </Button>
      </div>
      <BottomNavigation />
    </main>
  );
}
