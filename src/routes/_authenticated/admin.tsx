import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { CourseCsvImport } from "@/components/course/CourseCsvImport";
import {
  adminCreateCourse,
  adminDeleteCourse,
  adminDeletePlayer,
  adminDeleteRound,
  adminGetCourse,
  adminOverview,
  adminUpdateCourse,
  adminUpdatePenaltyAmounts,
  adminUpdatePlayerHandicaps,
  unlockAdmin,
} from "@/lib/admin.functions";

import { getMyProfile } from "@/lib/golf.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TeeBoxRows,
  defaultTeeBoxDrafts,
  parseTeeBoxes,
  type TeeBoxDraft,
} from "@/components/course/TeeBoxRows";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Birdie Battle" },
      { name: "description", content: "Golfplätze anlegen sowie Runden und Spieler verwalten." },
      { property: "og:title", content: "Admin — Birdie Battle" },
      { property: "og:description", content: "Plätze, Runden und Spieler verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const unlock = useServerFn(unlockAdmin);

  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    try {
      const result = await unlock({ data: { password } });
      if (!result.ok) {
        toast.error("Passwort stimmt nicht");
        return;
      }
      toast.success("Admin-Bereich freigeschaltet");
      setPassword("");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Es hat nicht geklappt");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 pb-16">
      <Link to="/dashboard" className="text-sm font-semibold text-muted-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-3xl font-black tracking-tight">Admin</h1>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Lade…</p>}

      {!isLoading && !me?.isAdmin && (
        <form onSubmit={submitPassword} className="mt-8 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Lock className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Gib das Super-Passwort ein, um den Admin-Bereich freizuschalten.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="admin-password">Super-Passwort</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-13"
              />
            </div>
            <Button type="submit" disabled={checking} className="mt-4 h-13 w-full font-bold">
              {checking ? "Prüfe…" : "Freischalten"}
            </Button>
          </div>
        </form>
      )}

      {me?.isAdmin && <AdminConsole />}
    </main>
  );
}

function AdminConsole() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(adminOverview);
  const deleteCourse = useServerFn(adminDeleteCourse);
  const deleteRound = useServerFn(adminDeleteRound);
  const deletePlayer = useServerFn(adminDeletePlayer);

  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });
  const [editCourseId, setEditCourseId] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    await queryClient.invalidateQueries({ queryKey: ["courses"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-course"] });
  }

  async function run(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      toast.success(message);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Es hat nicht geklappt");
    }
  }

  return (
    <div className="mt-8 space-y-10">
      <CourseForm
        key={editCourseId ?? "new"}
        courseId={editCourseId}
        onCancelEdit={() => setEditCourseId(null)}
        onSaved={async () => {
          setEditCourseId(null);
          await refresh();
        }}
      />

      <CourseCsvImport
        existingCourses={(data?.courses ?? []).map((c) => ({ name: c.name, city: c.city ?? null }))}
        onImported={refresh}
      />

      <PenaltyAmounts rules={data?.penaltyRules ?? []} onSaved={refresh} />

      <PlayerHandicaps players={data?.players ?? []} onSaved={refresh} />

      <AdminList
        title="Plätze"
        items={(data?.courses ?? []).map((c) => ({
          id: c.id,
          primary: c.name,
          secondary: `${c.city ?? "—"} · ${c.hole_count} Löcher${c.par_total ? ` · Par ${c.par_total}` : ""}`,
        }))}
        onEdit={(id) => {
          setEditCourseId(id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onDelete={(id) => run(() => deleteCourse({ data: { courseId: id } }), "Platz gelöscht")}
      />

      <AdminList
        title="Runden"
        items={(data?.rounds ?? []).map((r) => ({
          id: r.id,
          primary: r.course_name,
          secondary: `${new Date(r.played_on).toLocaleDateString("de-AT")} · ${r.hole_count} Löcher`,
        }))}
        onDelete={(id) => run(() => deleteRound({ data: { roundId: id } }), "Runde gelöscht")}
      />

      <AdminList
        title="Spieler"
        items={(data?.players ?? []).map((p) => ({
          id: p.id,
          primary: p.display_name,
          secondary: `@${p.handle}`,
        }))}
        onDelete={(id) => run(() => deletePlayer({ data: { playerId: id } }), "Spieler gelöscht")}
      />
    </div>
  );

}

function PenaltyAmounts({
  rules,
  onSaved,
}: {
  rules: { code: string; label: string; amount: number }[];
  onSaved: () => Promise<void> | void;
}) {
  const updateAmounts = useServerFn(adminUpdatePenaltyAmounts);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const valueFor = (r: { code: string; amount: number }) =>
    values[r.code] ?? r.amount.toFixed(2).replace(".", ",");

  async function save() {
    setSaving(true);
    try {
      await updateAmounts({
        data: {
          rules: rules.map((r) => ({
            code: r.code,
            amount: Math.min(99.99, Math.max(0, Number(valueFor(r).replace(",", ".")) || 0)),
          })),
        },
      });
      toast.success("Beträge gespeichert");
      setValues({});
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nicht gespeichert");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Strafkasse (Euro)
      </h2>
      <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        {rules.length === 0 && <p className="text-sm text-muted-foreground">Keine Strafen hinterlegt.</p>}
        {rules.map((r) => (
          <div key={r.code} className="flex items-center gap-3">
            <Label htmlFor={`amount-${r.code}`} className="flex-1">
              {r.label}
            </Label>
            <Input
              id={`amount-${r.code}`}
              inputMode="decimal"
              value={valueFor(r)}
              onChange={(e) => setValues((v) => ({ ...v, [r.code]: e.target.value }))}
              className="h-13 w-28 text-right"
            />
            <span className="text-sm font-bold text-muted-foreground">€</span>
          </div>
        ))}
        {rules.length > 0 && (
          <Button onClick={() => void save()} disabled={saving} className="h-13 w-full font-bold">
            {saving ? "Speichere…" : "Beträge speichern"}
          </Button>
        )}
      </div>
    </section>
  );
}

function AdminList({
  title,
  items,
  onDelete,
  onEdit,
}: {
  title: string;
  items: { id: string; primary: string; secondary: string }[];
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Noch nichts vorhanden.</p>}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{item.primary}</p>
              <p className="truncate text-xs text-muted-foreground">{item.secondary}</p>
            </div>
            {onEdit && (
              <button
                type="button"
                aria-label={`${item.primary} bearbeiten`}
                onClick={() => onEdit(item.id)}
                className="rounded-xl border border-border p-3 text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={`${item.primary} löschen`}
              onClick={() => {
                if (confirm(`"${item.primary}" wirklich löschen?`)) onDelete(item.id);
              }}
              className="rounded-xl border border-destructive/30 p-3 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>

          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerHandicaps({
  players,
  onSaved,
}: {
  players: { id: string; display_name: string; handle: string; handicap_index: number; default_tee: string }[];
  onSaved: () => Promise<void> | void;
}) {
  const update = useServerFn(adminUpdatePlayerHandicaps);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tees, setTees] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const hcpFor = (p: { id: string; handicap_index: number }) =>
    values[p.id] ?? String(p.handicap_index).replace(".", ",");
  const teeFor = (p: { id: string; default_tee: string }) => tees[p.id] ?? p.default_tee ?? "Gelb";

  async function save() {
    setSaving(true);
    try {
      await update({
        data: {
          players: players.map((p) => ({
            profileId: p.id,
            handicapIndex: Math.min(60, Math.max(-60, Number(hcpFor(p).replace(",", ".")) || -54)),
            tee: teeFor(p),
          })),
        },
      });
      toast.success("Handicaps gespeichert");
      setValues({});
      setTees({});
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nicht gespeichert");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Handicaps
      </h2>
      <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        {players.length === 0 && <p className="text-sm text-muted-foreground">Keine Spieler.</p>}
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <Label htmlFor={`hcp-${p.id}`} className="min-w-0 flex-1 truncate">
              {p.display_name}
            </Label>
            <Input
              id={`hcp-${p.id}`}
              inputMode="decimal"
              value={hcpFor(p)}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
              className="h-12 w-20 text-center"
            />
            <Input
              aria-label={`Abschlag ${p.display_name}`}
              value={teeFor(p)}
              maxLength={30}
              onChange={(e) => setTees((t) => ({ ...t, [p.id]: e.target.value }))}
              className="h-12 w-24 text-center"
            />
          </div>
        ))}
        {players.length > 0 && (
          <Button onClick={() => void save()} disabled={saving} className="h-13 w-full font-bold">
            {saving ? "Speichere…" : "Handicaps speichern"}
          </Button>
        )}
      </div>
    </section>
  );
}

function CourseForm({
  courseId,
  onSaved,
  onCancelEdit,
}: {
  courseId: string | null;
  onSaved: () => Promise<void> | void;
  onCancelEdit: () => void;
}) {
  const loadCourse = useServerFn(adminGetCourse);
  const createCourse = useServerFn(adminCreateCourse);
  const updateCourse = useServerFn(adminUpdateCourse);

  const { data: existing } = useQuery({
    queryKey: ["admin-course", courseId],
    queryFn: () => loadCourse({ data: { courseId: courseId as string } }),
    enabled: !!courseId,
  });

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [teeRows, setTeeRows] = useState<TeeBoxDraft[]>(() => defaultTeeBoxDrafts());
  const [pars, setPars] = useState<number[]>(() => Array.from({ length: 18 }, () => 4));
  const [sis, setSis] = useState<number[]>(() => Array.from({ length: 18 }, (_, i) => i + 1));
  const [sisBack, setSisBack] = useState<number[]>(() =>
    Array.from({ length: 9 }, (_, i) => i + 10),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setCity(existing.city);
    setHoleCount(existing.holeCount === 9 ? 9 : 18);
    setTeeRows(
      existing.teeBoxes.length > 0
        ? existing.teeBoxes.map((t) => ({
            name: t.name,
            slope: String(t.slope),
            cr: String(t.courseRating).replace(".", ","),
          }))
        : defaultTeeBoxDrafts(),
    );
    setPars(
      Array.from(
        { length: 18 },
        (_, i) => existing.holes.find((h) => h.hole_number === i + 1)?.par ?? 4,
      ),
    );
    setSis(
      Array.from(
        { length: 18 },
        (_, i) => existing.holes.find((h) => h.hole_number === i + 1)?.stroke_index ?? i + 1,
      ),
    );
    setSisBack(
      Array.from({ length: 9 }, (_, i) => {
        const h = existing.holes.find((x) => x.hole_number === i + 1);
        return h?.stroke_index_back ?? h?.stroke_index ?? i + 10;
      }),
    );
  }, [existing]);

  function num(value: string, fallback: number) {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Bitte einen Platznamen eingeben");
      return;
    }
    const teeBoxes = parseTeeBoxes(teeRows);
    if (teeBoxes.length === 0) {
      toast.error("Bitte mindestens einen Abschlag mit Namen eintragen");
      return;
    }
    const payload = {
      name: name.trim(),
      city: city.trim(),
      holeCount,
      teeBoxes,
      holes: Array.from({ length: holeCount }, (_, i) => ({
        hole_number: i + 1,
        par: pars[i] ?? 4,
        stroke_index: sis[i] ?? i + 1,
        stroke_index_back: holeCount === 9 ? (sisBack[i] ?? null) : null,
      })),
    };
    setSaving(true);
    try {
      if (courseId) {
        await updateCourse({ data: { ...payload, courseId } });
        toast.success("Platz aktualisiert");
      } else {
        await createCourse({ data: payload });
        toast.success("Platz angelegt");
        setName("");
        setCity("");
      }
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Platz konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {courseId ? "Golfplatz bearbeiten" : "Golfplatz anlegen"}
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="course-name">Name</Label>
          <Input
            id="course-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="h-13"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="course-city">Ort</Label>
          <Input
            id="course-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            className="h-13"
          />
        </div>
        <div className="space-y-2">
          <Label>Löcher</Label>
          <div className="flex h-13 overflow-hidden rounded-xl border border-border">
            {([9, 18] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setHoleCount(n)}
                className={`flex-1 text-sm font-bold ${
                  holeCount === n ? "bg-primary text-primary-foreground" : "bg-card"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <TeeBoxRows rows={teeRows} onChange={setTeeRows} idPrefix="admin-tee" />


        <div className="space-y-2">
          <Label>Par je Loch</Label>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: holeCount }, (_, i) => (
              <div key={i} className="text-center">
                <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                <Input
                  type="number"
                  min={3}
                  max={6}
                  value={pars[i] ?? 4}
                  onChange={(e) => {
                    const next = [...pars];
                    next[i] = Number(e.target.value);
                    setPars(next);
                  }}
                  className="h-11 px-1 text-center"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{holeCount === 9 ? "Stroke-Index Hinrunde (Loch 1–9)" : "Stroke-Index je Loch"}</Label>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: holeCount }, (_, i) => (
              <div key={i} className="text-center">
                <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                <Input
                  type="number"
                  min={1}
                  max={18}
                  value={sis[i] ?? i + 1}
                  onChange={(e) => {
                    const next = [...sis];
                    next[i] = Number(e.target.value);
                    setSis(next);
                  }}
                  className="h-11 px-1 text-center"
                />
              </div>
            ))}
          </div>
        </div>

        {holeCount === 9 && (
          <div className="space-y-2">
            <Label>Stroke-Index Rückrunde (Loch 10–18)</Label>
            <p className="text-xs text-muted-foreground">
              Gilt, wenn dieser 9-Loch-Platz als 18-Loch-Runde gespielt wird.
            </p>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="text-center">
                  <span className="text-[10px] text-muted-foreground">{i + 10}</span>
                  <Input
                    type="number"
                    min={1}
                    max={18}
                    value={sisBack[i] ?? i + 10}
                    onChange={(e) => {
                      const next = [...sisBack];
                      next[i] = Number(e.target.value);
                      setSisBack(next);
                    }}
                    className="h-11 px-1 text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        )}


        <Button type="submit" disabled={saving} className="h-13 w-full font-bold">
          {saving ? "Speichere…" : courseId ? "Änderungen speichern" : "Platz speichern"}
        </Button>
        {courseId && (
          <Button
            type="button"
            variant="outline"
            className="h-13 w-full font-bold"
            onClick={onCancelEdit}
          >
            Abbrechen
          </Button>
        )}
      </form>
    </section>
  );
}


