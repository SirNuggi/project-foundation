import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Flag, LayoutDashboard, MapPin, Minus, MoreVertical, Plus, Search, Sun, SunDim, Table2, Trash2, UserPlus, X } from "lucide-react";
import { useWakeLock } from "@/hooks/use-wake-lock";

const LiveMap = lazy(() => import("@/components/round/LiveMap"));
import {
  addPlayerToFlight,
  deleteFlight,
  finishFlight,
  getRoundBoard,
  saveHoleScore,
  searchPlayers,
  toggleGirly,
} from "@/lib/golf.functions";
import { supabase } from "@/integrations/supabase/client";
import { personalPars, stablefordPoints } from "@/lib/stableford";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { LiveLeaderboard, type BoardRow } from "@/components/round/LiveLeaderboard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/round/$roundId")({
  head: () => ({
    meta: [
      { title: "Runde — Birdie Battle" },
      { name: "description", content: "Live-Scoring mit Schlägen, Putts und Strafpunkten." },
      { property: "og:title", content: "Runde — Birdie Battle" },
      { property: "og:description", content: "Live-Scoring mit Schlägen, Putts und Strafpunkten." },
    ],
  }),
  component: RoundPage,
});

const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

function Counter({
  label,
  value,
  onChange,
  disabled,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex min-w-0 items-center justify-between gap-1">
        <button
          type="button"
          aria-label={`${label} verringern`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95 disabled:opacity-30"
        >
          <Minus className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 text-center text-2xl font-black tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          disabled={disabled}
          onClick={() => onChange(value + 1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-30"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function RoundPage() {
  const { roundId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchBoard = useServerFn(getRoundBoard);
  const saveScore = useServerFn(saveHoleScore);
  const setGirly = useServerFn(toggleGirly);
  const endFlight = useServerFn(finishFlight);
  const removeFlight = useServerFn(deleteFlight);
  const addToFlight = useServerFn(addPlayerToFlight);
  const findPlayers = useServerFn(searchPlayers);

  const [hole, setHole] = useState(1);
  const [holePickerOpen, setHolePickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [guest, setGuest] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { strokes: number; putts: number }>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: board, isLoading } = useQuery({
    queryKey: ["round-board", roundId],
    queryFn: () => fetchBoard({ data: { roundId } }),
  });

  const { data: results } = useQuery({
    queryKey: ["player-search", query],
    queryFn: () => findPlayers({ data: { q: query } }),
    enabled: addOpen && query.trim().length >= 2,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`round-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `round_id=eq.${roundId}` },
        () => queryClient.invalidateQueries({ queryKey: ["round-board", roundId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "penalties", filter: `round_id=eq.${roundId}` },
        () => queryClient.invalidateQueries({ queryKey: ["round-board", roundId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_players", filter: `round_id=eq.${roundId}` },
        () => queryClient.invalidateQueries({ queryKey: ["round-board", roundId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flights", filter: `round_id=eq.${roundId}` },
        () => queryClient.invalidateQueries({ queryKey: ["round-board", roundId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId, queryClient]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const par = board?.pars?.[hole] ?? 4;
  const myFlight = board?.flights.find((f) => f.id === board?.myFlightId) ?? null;
  const flightFinished = myFlight?.status === "finished";
  const finished = board?.status === "finished" || flightFinished;
  const myPlayers =
    board?.players.filter((p) =>
      board.myFlightId ? p.flightId === board.myFlightId : true,
    ) ?? [];

  // Wake Lock: Bildschirm bleibt an, solange die Runde läuft.
  const roundActive = !!board && !finished;
  const wake = useWakeLock(roundActive);

  useEffect(() => {
    if (!roundActive || !wake.enabled || !wake.blocked) return;
    toast.warning("Bildschirm kann nicht wachgehalten werden", {
      description:
        "Dein Handy blockiert das – meist wegen aktivem Energiesparmodus. Schalte ihn aus, damit der Bildschirm anbleibt.",
      id: "wake-lock-blocked",
    });
  }, [roundActive, wake.enabled, wake.blocked]);

  const personalParMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    if (!board) return map;
    const holes = Array.from({ length: board.holeCount }, (_, i) => ({
      holeNumber: i + 1,
      par: board.pars?.[i + 1] ?? 4,
      strokeIndex: board.strokeIndexes?.[i + 1] ?? i + 1,
    }));
    for (const p of board.players) map[p.id] = personalPars(holes, p.courseHandicap ?? 0);
    return map;
  }, [board]);

  function personalParFor(playerId: string) {
    return personalParMap[playerId]?.[hole] ?? par;
  }

  function scoreFor(playerId: string) {
    const key = `${playerId}-${hole}`;
    const draft = drafts[key];
    if (draft) return draft;
    const row = board?.scores.find(
      (s) => s.round_player_id === playerId && s.hole_number === hole,
    );
    return { strokes: row?.strokes ?? personalParFor(playerId), putts: row?.putts ?? 0 };
  }


  function ruleAmount(code: string) {
    return Number(board?.rules.find((r) => r.code === code)?.amount ?? 0);
  }

  function penaltyActive(playerId: string, code: string) {
    return !!board?.penalties.find(
      (p) => p.round_player_id === playerId && p.hole_number === hole && p.code === code,
    );
  }

  function update(playerId: string, next: { strokes: number; putts: number }) {
    const key = `${playerId}-${hole}`;
    setDrafts((d) => ({ ...d, [key]: next }));
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try {
        await saveScore({
          data: {
            roundId,
            roundPlayerId: playerId,
            holeNumber: hole,
            par,
            strokes: next.strokes,
            putts: next.putts,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["round-board", roundId] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      }
    }, 500);
  }

  const rows: BoardRow[] = useMemo(() => {
    if (!board) return [];
    return board.players
      .map((p) => {
        const scores = board.scores.filter((s) => s.round_player_id === p.id);
        const strokes = scores.reduce((a, s) => a + (s.strokes ?? 0), 0);
        const putts = scores.reduce((a, s) => a + (s.putts ?? 0), 0);
        const parSum = scores.reduce((a, s) => a + (board.pars?.[s.hole_number] ?? 4), 0);
        const euro = board.penalties
          .filter((x) => x.round_player_id === p.id)
          .reduce((a, x) => a + Number(x.amount ?? 0), 0);
        const pp = personalParMap[p.id] ?? {};
        const points = scores.reduce(
          (a, s) =>
            a +
            stablefordPoints(
              pp[s.hole_number] ?? board.pars?.[s.hole_number] ?? 4,
              s.strokes ?? 0,
            ),
          0,
        );
        return {
          id: p.id,
          name: p.name,
          flight: p.flightNumber ?? null,
          strokes,
          putts,
          toPar: strokes - parSum,
          euro,
          points,
        };
      })
      .sort((a, b) => a.strokes - b.strokes || b.euro - a.euro);
  }, [board, personalParMap]);


  const holeCount = board?.holeCount ?? 18;
  const holeRows = useMemo(() => {
    const all = Array.from({ length: holeCount }, (_, i) => i + 1);
    const chunks: number[][] = [];
    for (let i = 0; i < all.length; i += 5) chunks.push(all.slice(i, i + 5));
    return chunks;
  }, [holeCount]);

  const canDeleteFlight = !!board?.canDeleteMyFlight && !!board?.myFlightId;

  async function removeMyFlight() {
    if (!board?.myFlightId) return;
    setBusy(true);
    try {
      const res = await removeFlight({ data: { roundId, flightId: board.myFlightId } });
      await queryClient.invalidateQueries({ queryKey: ["my-rounds"] });
      await queryClient.invalidateQueries({ queryKey: ["round-board", roundId] });
      setDeleteOpen(false);
      setFinishOpen(false);
      toast.success(res?.roundDeleted ? "Runde gelöscht" : "Flight gelöscht");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setBusy(false);
    }
  }


  return (
    <main className="min-h-screen bg-background pb-64 pt-[120px]">
      <header className="fixed inset-x-0 top-0 z-30 flex h-[120px] flex-col justify-center bg-secondary px-4 text-secondary-foreground">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black leading-5 tracking-tight">
            {board?.roundName ?? board?.courseName ?? (isLoading ? "Lade…" : "Runde")}
          </h1>
          {board?.roundName ? (
            <p className="truncate text-xs font-semibold leading-3 text-secondary-foreground/70">
              {board.courseName}
            </p>
          ) : null}
        </div>

        {board ? (
          <div className="mt-1 flex items-center gap-1.5 overflow-hidden text-[10px] font-bold">
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-sidebar-accent px-1.5 py-1">
              <CalendarDays className="h-3 w-3 text-primary" />
              {new Date(board.playedOn).toLocaleDateString("de-AT")}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-sidebar-accent px-1.5 py-1">
              <Clock3 className="h-3 w-3 text-primary" />
              {new Date(board.createdAt).toLocaleTimeString("de-AT", {
                hour: "2-digit",
                minute: "2-digit",
              })} Uhr
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-sidebar-accent px-1.5 py-1">
              <Flag className="h-3 w-3 text-primary" /> {board.holeCount} Löcher
            </span>
            {!finished ? (
              <button
                type="button"
                onClick={() => {
                  wake.toggle();
                  if (wake.enabled) {
                    toast("Bildschirm-Wachhalten aus");
                  } else {
                    toast("Bildschirm-Wachhalten ein");
                  }
                }}
                aria-label={
                  wake.active
                    ? "Bildschirm bleibt an – antippen zum Ausschalten"
                    : "Bildschirm-Wachhalten einschalten"
                }
                title={
                  wake.active
                    ? "Bildschirm bleibt an"
                    : wake.blocked
                      ? "Vom Handy blockiert (Energiesparmodus?)"
                      : "Bildschirm-Wachhalten aus"
                }
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-sidebar-accent"
              >
                {wake.active ? (
                  <Sun className="h-3 w-3 text-primary" />
                ) : (
                  <SunDim
                    className={
                      wake.blocked
                        ? "h-3 w-3 text-destructive"
                        : "h-3 w-3 text-secondary-foreground/40"
                    }
                  />
                )}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            aria-label="Vorheriges Loch"
            onClick={() => setHole((h) => Math.max(1, h - 1))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <Popover open={holePickerOpen} onOpenChange={setHolePickerOpen}>
            <PopoverTrigger className="whitespace-nowrap px-1 text-left text-base font-black">
              Loch {hole} · Par {par}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-3">
              <div className="space-y-2">
                {holeRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    {row.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setHole(h);
                          setHolePickerOpen(false);
                        }}
                        className={`h-11 w-11 rounded-xl text-sm font-black ${
                          h === hole
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            aria-label="Nächstes Loch"
            onClick={() => setHole((h) => Math.min(holeCount, h + 1))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="Live-Karte öffnen"
            onClick={() => setMapOpen(true)}
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <MapPin className="h-5 w-5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menü"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent"
            >
              <MoreVertical className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/round/$roundId/scorecard" params={{ roundId }}>
                  <Table2 className="mr-2 h-4 w-4" /> Scorecard anzeigen
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </DropdownMenuItem>
              {canDeleteFlight && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Flight löschen
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <section className="space-y-4 px-6 py-6">
        {myPlayers.map((p) => {
          const s = scoreFor(p.id);
          const girlyOn = penaltyActive(p.id, "girly");
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-black">{p.name}</p>
                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                  Mein Par: {personalParFor(p.id)}
                  {p.isGuest ? " · Gast" : ""}
                </span>
              </div>


              {board?.withPenalties && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      penaltyActive(p.id, "double_par")
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Doppel-Par {eur.format(ruleAmount("double_par"))}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      penaltyActive(p.id, "three_putt")
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    3-Putt {eur.format(ruleAmount("three_putt"))}
                  </span>
                  <button
                    type="button"
                    disabled={finished}
                    onClick={async () => {
                      try {
                        await setGirly({
                          data: {
                            roundId,
                            roundPlayerId: p.id,
                            holeNumber: hole,
                            active: !girlyOn,
                          },
                        });
                        await queryClient.invalidateQueries({ queryKey: ["round-board", roundId] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Nicht gespeichert");
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      girlyOn
                        ? "bg-destructive text-destructive-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    Girly {eur.format(ruleAmount("girly"))}
                  </button>
                </div>
              )}

              <div className="mt-4 flex gap-4">
                <Counter
                  label="Schläge"
                  value={s.strokes}
                  min={1}
                  disabled={finished}
                  onChange={(v) => update(p.id, { ...s, strokes: v })}
                />
                <Counter
                  label="Putts"
                  value={s.putts}
                  min={0}
                  disabled={finished}
                  onChange={(v) => update(p.id, { ...s, putts: v })}
                />
              </div>
            </div>
          );
        })}

        {!finished && (
          <Button
            variant="outline"
            className="h-13 w-full font-bold"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-2 h-5 w-5" /> Spieler zu meinem Flight hinzufügen
          </Button>
        )}

        {!finished && (
          <Button
            variant="secondary"
            className="h-14 w-full text-base font-bold"
            onClick={() => setFinishOpen(true)}
          >
            <Flag className="mr-2 h-5 w-5" /> Flight beenden
          </Button>
        )}
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spieler zu meinem Flight hinzufügen</DialogTitle>
            <DialogDescription>
              Suche einen registrierten Spieler oder trage einen Gast ein.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Spieler suchen"
                className="h-13 pl-11"
                maxLength={50}
              />
            </div>

            {query.trim().length >= 2 && (
              <div className="space-y-2">
                {(results?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground">Kein Spieler gefunden.</p>
                )}
                {results?.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!board?.myFlightId) return;
                      setBusy(true);
                      try {
                        await addToFlight({
                          data: {
                            roundId,
                            flightId: board.myFlightId,
                            profileId: r.id,
                            handicapIndex: r.handicap_index,
                            teeName: r.default_tee,
                          },
                        });
                        await queryClient.invalidateQueries({ queryKey: ["round-board", roundId] });
                        setQuery("");
                        setAddOpen(false);
                        toast.success(`${r.display_name} hinzugefügt`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Nicht möglich");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block font-semibold">{r.display_name}</span>
                      <span className="block text-xs text-muted-foreground">@{r.handle}</span>
                    </span>
                    <UserPlus className="h-5 w-5 text-primary" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                placeholder="Gast ohne Konto"
                maxLength={50}
                className="h-13"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-13 px-5"
                disabled={busy}
                onClick={async () => {
                  const name = guest.trim();
                  if (!name || !board?.myFlightId) return;
                  setBusy(true);
                  try {
                    await addToFlight({
                      data: { roundId, flightId: board.myFlightId, guestName: name },
                    });
                    await queryClient.invalidateQueries({ queryKey: ["round-board", roundId] });
                    setGuest("");
                    setAddOpen(false);
                    toast.success(`${name} hinzugefügt`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Nicht möglich");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Gast
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flight beenden?</DialogTitle>
            <DialogDescription>
              Speichern beendet deinen Flight. Sobald alle Flights beendet sind, wird die gesamte
              Runde archiviert. Löschen verwirft nur diesen Flight samt seinen Eingaben.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-13 w-full font-bold"
              disabled={busy || !board?.myFlightId}
              onClick={async () => {
                if (!board?.myFlightId) return;
                setBusy(true);
                try {
                  const res = await endFlight({
                    data: { roundId, flightId: board.myFlightId },
                  });
                  await queryClient.invalidateQueries({ queryKey: ["round-board", roundId] });
                  setFinishOpen(false);
                  toast.success(res?.roundFinished ? "Runde beendet" : "Flight beendet");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Nicht gespeichert");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Speichern
            </Button>
            {canDeleteFlight && !finished && (
              <Button
                variant="destructive"
                className="h-13 w-full font-bold"
                disabled={busy}
                onClick={() => {
                  setFinishOpen(false);
                  setDeleteOpen(true);
                }}
              >
                Löschen
              </Button>
            )}
            <Button
              variant="outline"
              className="h-13 w-full font-bold"
              disabled={busy}
              onClick={() => setFinishOpen(false)}
            >
              Weiter spielen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flight {myFlight?.number ?? ""} wirklich löschen?</DialogTitle>
            <DialogDescription>
              Alle Eingaben dieses Flights gehen verloren. Die anderen Flights und die Runde bleiben
              bestehen. Ist es der letzte Flight, wird auch die Runde gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="h-13 w-full font-bold"
              disabled={busy}
              onClick={() => void removeMyFlight()}
            >
              Endgültig löschen
            </Button>
            <Button
              variant="outline"
              className="h-13 w-full font-bold"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <LiveLeaderboard rows={rows} showPenalties={board?.withPenalties !== false} />

      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute inset-0">
            <ClientOnly fallback={null}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm font-bold text-muted-foreground">
                    Karte wird geladen …
                  </div>
                }
              >
                <LiveMap />
              </Suspense>
            </ClientOnly>
          </div>
          <button
            type="button"
            aria-label="Karte schließen"
            onClick={() => setMapOpen(false)}
            className="absolute right-4 top-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </main>
  );
}
