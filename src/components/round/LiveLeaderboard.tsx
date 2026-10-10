import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BoardRow = {
  id: string;
  name: string;
  flight?: number | null;
  strokes: number;
  putts: number;
  toPar: number;
  euro: number;
  points: number;
};

const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

type Tab = "strokes" | "money" | "points";

export function LiveLeaderboard({
  rows,
  showPenalties = true,
  embedded = false,
}: {
  rows: BoardRow[];
  showPenalties?: boolean;
  embedded?: boolean;
}) {
  const [openState, setOpen] = useState(false);
  const open = embedded || openState;
  const [tab, setTab] = useState<Tab>("strokes");
  const activeTab: Tab = tab === "money" && !showPenalties ? "strokes" : tab;

  const tabs: [Tab, string][] = showPenalties
    ? [
        ["strokes", "Schläge"],
        ["money", "Strafen"],
        ["points", "Stableford Netto"],
      ]
    : [
        ["strokes", "Schläge"],
        ["points", "Stableford Netto"],
      ];

  const sorted = [...rows].sort((a, b) => {
    if (activeTab === "strokes") return a.strokes - b.strokes;
    if (activeTab === "money") return b.euro - a.euro;
    return b.points - a.points;
  });

  return (
    <div className={embedded ? "" : "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur"}>
      <div className="flex items-center gap-2 px-6 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-3 py-1 text-left"
        >
          <Trophy className="h-5 w-5 shrink-0 text-primary" />
          <span className="text-sm font-black uppercase tracking-widest">Leaderboard</span>
        </button>

        {open && (
          <Select value={activeTab} onValueChange={(value) => setTab(value as Tab)}>
            <SelectTrigger aria-label="Leaderboard sortieren" className="h-9 min-w-0 flex-1 text-xs font-bold sm:max-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tabs.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <button
          type="button"
          aria-label={open ? "Leaderboard einklappen" : "Leaderboard ausklappen"}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center"
        >
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="max-h-64 overflow-y-auto px-6 pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 text-left font-bold">Spieler</th>
                <th className="py-2 text-right font-bold">Punkte</th>
                <th className="py-2 text-right font-bold">Schläge</th>
                <th className="py-2 text-right font-bold">+/-</th>
                <th className="py-2 text-right font-bold">Putts</th>
                {showPenalties && <th className="py-2 text-right font-bold">Strafen</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 font-bold">
                    <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                    {r.name}
                    {r.flight ? (
                      <span className="ml-1 text-[10px] font-bold text-muted-foreground">
                        (F{r.flight})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-right font-black tabular-nums text-primary">
                    {r.points}
                  </td>
                  <td className="py-3 text-right font-black">{r.strokes}</td>
                  <td className="py-3 text-right tabular-nums">
                    {r.toPar > 0 ? `+${r.toPar}` : r.toPar}
                  </td>
                  <td className="py-3 text-right tabular-nums">{r.putts}</td>
                  {showPenalties && (
                    <td className="py-3 text-right font-black tabular-nums text-destructive">
                      {eur.format(r.euro)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
