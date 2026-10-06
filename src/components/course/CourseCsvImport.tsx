import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { adminCreateCourse } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TeeBox = { name: string; slope: number; courseRating: number };
type ParsedCourse = {
  line: number;
  name: string;
  city: string;
  holeCount: 9 | 18;
  teeBoxes: TeeBox[];
  holes: { hole_number: number; par: number; stroke_index: number | null; stroke_index_back: number | null }[];
  errors: string[];
  duplicate: boolean;
};

const MAX_TEES = 10;

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function numList(raw: string) {
  return raw
    .split(/[,\s|/]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v));
}

function parseTees(raw: string, errors: string[]): TeeBox[] {
  const tees: TeeBox[] = [];
  for (const part of raw.split("|").map((p) => p.trim()).filter(Boolean)) {
    const [name, slopeRaw, crRaw] = part.split(":").map((v) => v?.trim() ?? "");
    const slope = Math.round(Number(slopeRaw));
    const cr = Number((crRaw ?? "").replace(",", "."));
    if (!name || !Number.isFinite(slope) || slope < 55 || slope > 155 || !Number.isFinite(cr) || cr < 40 || cr > 90) {
      errors.push(`Abschlag „${part}“ ungültig`);
      continue;
    }
    tees.push({ name: name.slice(0, 30), slope, courseRating: cr });
  }
  if (tees.length === 0) errors.push("Keine Abschläge");
  if (tees.length > MAX_TEES) errors.push(`Mehr als ${MAX_TEES} Abschläge`);
  return tees;
}

function parseCsv(text: string, existing: { name: string; city: string | null }[]): ParsedCourse[] {
  const existingKeys = new Set(existing.map((c) => `${norm(c.name)}|${norm(c.city ?? "")}`));
  const seen = new Set<string>();
  const result: ParsedCourse[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    if (!rawLine.trim()) return;
    const cells = rawLine.split(";").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    if (idx === 0 && norm(cells[0] ?? "") === "name") return;

    const [name = "", city = "", holeRaw = "", teesRaw = "", parsRaw = "", siRaw = "", siBackRaw = ""] = cells;
    const errors: string[] = [];
    if (name.length < 2) errors.push("Name fehlt");
    const holeNum = Number(holeRaw);
    if (holeNum !== 9 && holeNum !== 18) errors.push("hole_count muss 9 oder 18 sein");
    const holeCount = (holeNum === 9 ? 9 : 18) as 9 | 18;
    const teeBoxes = parseTees(teesRaw, errors);

    const pars = numList(parsRaw);
    const si = numList(siRaw);
    const siBack = numList(siBackRaw);
    if (pars.length !== holeCount) errors.push(`${pars.length} Pars statt ${holeCount}`);
    if (pars.some((p) => !Number.isInteger(p) || p < 3 || p > 6)) errors.push("Par-Werte ungültig");
    if (si.length > 0 && si.length !== holeCount) errors.push("Anzahl Stroke-Indizes passt nicht");
    if (si.some((v) => !Number.isInteger(v) || v < 1 || v > 18)) errors.push("Stroke-Index ungültig");
    if (siBack.length > 0 && siBack.length !== holeCount) errors.push("Anzahl Stroke-Indizes (Back) passt nicht");
    if (siBack.some((v) => !Number.isInteger(v) || v < 1 || v > 18)) errors.push("Stroke-Index (Back) ungültig");

    const key = `${norm(name)}|${norm(city)}`;
    const duplicate = existingKeys.has(key) || seen.has(key);
    seen.add(key);

    result.push({
      line: idx + 1,
      name,
      city,
      holeCount,
      teeBoxes,
      holes: pars.slice(0, holeCount).map((par, i) => ({
        hole_number: i + 1,
        par,
        stroke_index: si[i] ?? null,
        stroke_index_back: siBack[i] ?? null,
      })),
      errors,
      duplicate,
    });
  });
  return result;
}

export function CourseCsvImport({
  existingCourses,
  onImported,
}: {
  existingCourses: { name: string; city: string | null }[];
  onImported: () => Promise<void> | void;
}) {
  const createCourse = useServerFn(adminCreateCourse);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedCourse[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("Bitte eine CSV-Datei wählen");
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    const parsed = parseCsv(text, existingCourses);
    setRows(parsed);
    if (parsed.length === 0) toast.error("Keine Plätze in der Datei gefunden");
  }

  const importable = rows.filter((r) => r.errors.length === 0 && !r.duplicate);

  async function runImport() {
    setImporting(true);
    let ok = 0;
    const failed: string[] = [];
    for (const r of importable) {
      try {
        await createCourse({
          data: { name: r.name, city: r.city || undefined, holeCount: r.holeCount, teeBoxes: r.teeBoxes, holes: r.holes },
        });
        ok++;
      } catch (err) {
        failed.push(`${r.name}: ${err instanceof Error ? err.message : "Fehler"}`);
      }
    }
    setImporting(false);
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? "Platz" : "Plätze"} importiert`);
    if (failed.length > 0) toast.error(failed.join("\n"));
    setRows([]);
    setFileName(null);
    await onImported();
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Plätze per CSV importieren</h2>
        <p className="text-xs text-muted-foreground">
          Format (Semikolon-getrennt): name;city;hole_count;tees;pars;stroke_indices;stroke_indices_back
          <br />
          tees: <code>Gelb:125:70,1|Rot:120:71,8</code> · pars/Indizes: <code>4,4,3,5,…</code>
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/10" : "border-border bg-muted/30",
        )}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-semibold">{fileName ?? "CSV-Datei hierher ziehen oder tippen"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.txt"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2">Platz</th>
                  <th className="p-2">Löcher</th>
                  <th className="p-2">Par</th>
                  <th className="p-2">Abschläge</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t align-top">
                    <td className="p-2">
                      <div className="font-semibold">{r.name || "—"}</div>
                      <div className="text-muted-foreground">{r.city || "—"}</div>
                    </td>
                    <td className="p-2">{r.holeCount}</td>
                    <td className="p-2">{r.holes.reduce((s, h) => s + h.par, 0) || "—"}</td>
                    <td className="p-2">
                      {r.teeBoxes.map((t) => (
                        <div key={t.name} className="whitespace-nowrap">
                          {t.name} · {t.slope} / {t.courseRating.toFixed(1).replace(".", ",")}
                        </div>
                      ))}
                    </td>
                    <td className="p-2">
                      {r.errors.length > 0 ? (
                        <span className="text-destructive">{r.errors.join(", ")}</span>
                      ) : r.duplicate ? (
                        <span className="text-muted-foreground">Existiert bereits</span>
                      ) : (
                        <span className="font-semibold text-primary">Bereit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            onClick={runImport}
            disabled={importing || importable.length === 0}
            className="h-12 w-full font-bold"
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {importable.length} {importable.length === 1 ? "Platz" : "Plätze"} importieren
          </Button>
        </>
      )}
    </section>
  );
}
