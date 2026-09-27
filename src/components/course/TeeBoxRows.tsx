import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TeeBoxDraft = { name: string; slope: string; cr: string };

export const MAX_TEE_BOXES = 6;

export function defaultTeeBoxDrafts(): TeeBoxDraft[] {
  return [
    { name: "Gelb", slope: "103", cr: "63,1" },
    { name: "Rot", slope: "103", cr: "63,9" },
  ];
}

function toNumber(value: string, fallback: number) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/** Wandelt die Eingaben in das Format der Server-Funktionen. */
export function parseTeeBoxes(rows: TeeBoxDraft[]) {
  return rows
    .filter((r) => r.name.trim().length > 0)
    .map((r) => ({
      name: r.name.trim().slice(0, 30),
      slope: Math.min(155, Math.max(55, Math.round(toNumber(r.slope, 103)))),
      courseRating: Math.min(90, Math.max(40, toNumber(r.cr, 70))),
    }));
}

export function TeeBoxRows({
  rows,
  onChange,
  idPrefix = "tee",
}: {
  rows: TeeBoxDraft[];
  onChange: (rows: TeeBoxDraft[]) => void;
  idPrefix?: string;
}) {
  function update(index: number, patch: Partial<TeeBoxDraft>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      <Label>Abschläge (max. {MAX_TEE_BOXES})</Label>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="min-w-0 flex-[2] space-y-1">
              {i === 0 && <span className="text-[10px] text-muted-foreground">Name</span>}
              <Input
                id={`${idPrefix}-name-${i}`}
                value={row.name}
                maxLength={30}
                placeholder="Gelb"
                onChange={(e) => update(i, { name: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {i === 0 && <span className="text-[10px] text-muted-foreground">Slope</span>}
              <Input
                inputMode="numeric"
                value={row.slope}
                onChange={(e) => update(i, { slope: e.target.value })}
                className="h-12 px-2 text-center"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {i === 0 && <span className="text-[10px] text-muted-foreground">CR</span>}
              <Input
                inputMode="decimal"
                value={row.cr}
                onChange={(e) => update(i, { cr: e.target.value })}
                className="h-12 px-2 text-center"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Abschlag entfernen"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="h-12 w-12 shrink-0 text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {rows.length < MAX_TEE_BOXES && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...rows, { name: "", slope: "103", cr: "70,0" }])}
          className="h-11 w-full font-bold"
        >
          <Plus className="mr-1 h-4 w-4" /> Abschlag hinzufügen
        </Button>
      )}
    </div>
  );
}
