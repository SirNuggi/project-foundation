import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, Clock3, Flag } from "lucide-react";
import { getRoundBoard } from "@/lib/golf.functions";
import { personalPars, stablefordPoints, strokesPerHole, type HoleInfo } from "@/lib/stableford";

export const Route = createFileRoute("/_authenticated/round/$roundId_/scorecard")({
  head: () => ({
    meta: [
      { title: "Gesamt-Scorecard — Birdie Battle" },
      {
        name: "description",
        content: "Komplette Scorecard mit Schlägen, Netto- und Bruttopunkten sowie Putts.",
      },
      { property: "og:title", content: "Gesamt-Scorecard — Birdie Battle" },
      {
        property: "og:description",
        content: "Komplette Scorecard mit Schlägen, Netto- und Bruttopunkten sowie Putts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScorecardPage,
});

type Cells = (number | string | null)[];

function sum(values: (number | null)[]) {
  const nums = values.filter((v): v is number => typeof v === "number");
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

function ScorecardPage() {
  const { roundId } = Route.useParams();
  const fetchBoard = useServerFn(getRoundBoard);
  const [flightFilter, setFlightFilter] = useState<string | null>(null);
  const { data: board, isLoading } = useQuery({
    queryKey: ["round-board", roundId],
    queryFn: () => fetchBoard({ data: { roundId } }),
  });

  const holes: HoleInfo[] = useMemo(() => {
    if (!board) return [];
    return Array.from({ length: board.holeCount }, (_, i) => ({
      holeNumber: i + 1,
      par: board.pars?.[i + 1] ?? 4,
      strokeIndex: board.strokeIndexes?.[i + 1] ?? i + 1,
    }));
  }, [board]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-8 text-sm font-bold text-muted-foreground">
        Lade Scorecard …
      </main>
    );
  }
  if (!board) {
    return (
      <main className="min-h-screen bg-background px-6 py-8">
        <p className="text-sm font-bold">Runde nicht gefunden.</p>
      </main>
    );
  }

  const front = holes.filter((h) => h.holeNumber <= 9);
  const back = holes.filter((h) => h.holeNumber > 9);
  const hasBack = back.length > 0;

  function segments(values: Record<number, number | null>): {
    cells: Cells;
    out: number | null;
    inn: number | null;
    tot: number | null;
  } {
    const frontVals = front.map((h) => values[h.holeNumber] ?? null);
    const backVals = back.map((h) => values[h.holeNumber] ?? null);
    const out = sum(frontVals);
    const inn = hasBack ? sum(backVals) : null;
    const tot = sum([...frontVals, ...backVals]);
    const cells: Cells = [...frontVals, out];
    if (hasBack) cells.push(...backVals, inn);
    cells.push(tot);
    return { cells, out, inn, tot };
  }

  function Row({
    label,
    values,
    strong,
    muted,
  }: {
    label: string;
    values: Record<number, number | string | null>;
    strong?: boolean;
    muted?: boolean;
  }) {
    const numeric: Record<number, number | null> = {};
    for (const h of holes) {
      const v = values[h.holeNumber];
      numeric[h.holeNumber] = typeof v === "number" ? v : null;
    }
    const { out, inn, tot } = segments(numeric);
    const isText = holes.some((h) => typeof values[h.holeNumber] === "string");

    const cells: Cells = [];
    for (const h of front) cells.push(values[h.holeNumber] ?? "");
    cells.push(isText ? "" : out);
    if (hasBack) {
      for (const h of back) cells.push(values[h.holeNumber] ?? "");
      cells.push(isText ? "" : inn);
    }
    cells.push(isText ? "" : tot);

    return (
      <tr className="border-t border-border">
        <th
          scope="row"
          className={`sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-bold ${
            muted ? "text-muted-foreground" : ""
          }`}
        >
          {label}
        </th>
        {cells.map((c, i) => (
          <td
            key={i}
            className={`px-2 py-2 text-center text-xs tabular-nums ${
              strong ? "font-black" : "font-semibold"
            }`}
          >
            {c === null ? "" : c}
          </td>
        ))}
      </tr>
    );
  }

  const headerCells: string[] = [
    ...front.map((h) => String(h.holeNumber)),
    "out",
    ...(hasBack ? [...back.map((h) => String(h.holeNumber)), "in"] : []),
    "tot",
  ];

  const parValues: Record<number, number> = {};
  for (const h of holes) parValues[h.holeNumber] = h.par;

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="flex h-[120px] flex-col justify-center bg-secondary px-4 text-secondary-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/round/$roundId"
            params={{ roundId }}
            aria-label="Zurück zur Runde"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black leading-5 tracking-tight">
              <span>{board.roundName ?? board.courseName}</span>
              {board.groupName ? (
                <>
                  <span className="opacity-60"> · </span>
                  <span>{board.groupName}</span>
                </>
              ) : null}
            </h1>
            {board.roundName ? (
              <p className="truncate text-xs font-semibold leading-3 text-secondary-foreground/70">
                {board.courseName}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden text-[10px] font-bold">
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
        </div>
      </header>

      {board.flights.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
            {board.flights.map((f) => {
              const active = (flightFilter ?? board.myFlightId) === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFlightFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    active ? "bg-primary text-primary-foreground" : "bg-sidebar-accent"
                  }`}
                >
                  Flight {f.number}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setFlightFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                flightFilter === "all" ? "bg-primary text-primary-foreground" : "bg-sidebar-accent"
              }`}
            >
              Alle Flights
            </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-xs font-black uppercase">
                loch
              </th>
              {headerCells.map((c, i) => (
                <td
                  key={i}
                  className="min-w-9 px-2 py-2 text-center text-xs font-black uppercase tabular-nums"
                >
                  {c}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="par" values={parValues} strong />

            {board.players
              .filter((p) => {
                const sel = flightFilter ?? board.myFlightId;
                if (!sel || sel === "all") return true;
                return p.flightId === sel;
              })
              .map((p) => {
              const hcp = p.courseHandicap ?? 0;
              const extra = strokesPerHole(holes, hcp);
              const pp = personalPars(holes, hcp);
              const strokes: Record<number, number | null> = {};
              const putts: Record<number, number | null> = {};
              const netto: Record<number, number | null> = {};
              const brutto: Record<number, number | null> = {};
              const vorgabe: Record<number, string> = {};
              for (const h of holes) {
                const row = board.scores.find(
                  (s) => s.round_player_id === p.id && s.hole_number === h.holeNumber,
                );
                const st = row?.strokes ?? null;
                strokes[h.holeNumber] = st;
                putts[h.holeNumber] = row?.putts ?? null;
                netto[h.holeNumber] =
                  st === null ? null : stablefordPoints(pp[h.holeNumber] ?? h.par, st);
                brutto[h.holeNumber] = st === null ? null : stablefordPoints(h.par, st);
                vorgabe[h.holeNumber] = "|".repeat(extra[h.holeNumber] ?? 0);
              }
              const index = p.handicapIndex === null ? null : Number(p.handicapIndex);
              return (
                <Fragment key={p.id}>
                  <tr className="border-t-2 border-foreground/20 bg-accent/40">
                    <th
                      scope="row"
                      colSpan={headerCells.length + 1}
                      className="sticky left-0 z-10 bg-accent/40 px-3 py-2 text-left text-xs font-black"
                    >
                      {p.name}
                      {p.tee ? ` | ${p.tee}` : ""} |{" "}
                      {index === null ? "—" : index.toFixed(1).replace(".", ",")} /{" "}
                      {String(hcp).replace(".", ",")}
                    </th>
                  </tr>
                  <Row key={`${p.id}-vorg`} label="Vorgabe" values={vorgabe} muted />
                  <Row key={`${p.id}-strokes`} label="Schläge" values={strokes} strong />
                  <Row key={`${p.id}-netto`} label="Pkt. Netto" values={netto} />
                  <Row key={`${p.id}-brutto`} label="Pkt. Brutto" values={brutto} />
                  <Row key={`${p.id}-putts`} label="Puts" values={putts} muted />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
