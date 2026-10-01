import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGroupPenaltyRules, saveGroupPenaltyRules } from "@/lib/groups.functions";

type Rule = { code: string; label: string; amount: string; is_automatic: boolean };

const toStr = (n: number) => n.toFixed(2).replace(".", ",");
const parse = (s: string) => {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() && Number.isFinite(n) && n >= 0 && n <= 9999.99 ? n : null;
};
const slug = (s: string) =>
  "custom_" +
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

export function GroupPenaltyRulesDialog({
  open,
  onOpenChange,
  groupId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
}) {
  const qc = useQueryClient();
  const fetchRules = useServerFn(getGroupPenaltyRules);
  const save = useServerFn(saveGroupPenaltyRules);
  const { data } = useQuery({
    queryKey: ["group-penalty-rules", groupId],
    queryFn: () => fetchRules({ data: { groupId } }),
    enabled: open,
  });
  const [rules, setRules] = useState<Rule[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("1,00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && data) {
      setRules(data.map((r) => ({ code: r.code, label: r.label, amount: toStr(r.amount), is_automatic: r.is_automatic })));
    }
  }, [open, data]);

  const update = (i: number, patch: Partial<Rule>) =>
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function addRule() {
    const label = newLabel.trim();
    const amount = parse(newAmount);
    if (!label) { toast.error("Bitte einen Namen eingeben"); return; }
    if (amount === null) { toast.error("Ungültiger Betrag"); return; }
    let code = slug(label);
    let i = 1;
    while (rules.some((r) => r.code === code)) code = `${slug(label)}_${++i}`;
    setRules((rs) => [...rs, { code, label, amount: toStr(amount), is_automatic: false }]);
    setNewLabel("");
    setNewAmount("1,00");
  }

  async function handleSave() {
    const out = [];
    for (const r of rules) {
      const amount = parse(r.amount);
      if (amount === null || !r.label.trim()) { toast.error(`Ungültige Angabe bei "${r.label || "Strafe"}"`); return; }
      out.push({ code: r.code, label: r.label.trim(), amount, is_automatic: r.is_automatic });
    }
    setBusy(true);
    try {
      await save({ data: { groupId, rules: out } });
      await qc.invalidateQueries({ queryKey: ["group-penalty-rules", groupId] });
      toast.success("Strafregeln gespeichert");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  }

  const auto = rules.map((r, i) => ({ r, i })).filter(({ r }) => r.is_automatic);
  const manual = rules.map((r, i) => ({ r, i })).filter(({ r }) => !r.is_automatic);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Strafen festlegen</DialogTitle>
          <DialogDescription>Beträge in Euro für die Strafkasse dieser Gruppe.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Automatisch</p>
            {auto.map(({ r, i }) => (
              <div key={r.code} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-bold">{r.label}</span>
                <AmountInput value={r.amount} onChange={(v) => update(i, { amount: v })} label={r.label} />
                <span className="w-10" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Eigene Strafen</p>
            {manual.length === 0 && <p className="text-sm text-muted-foreground">Noch keine eigenen Strafen.</p>}
            {manual.map(({ r, i }) => (
              <div key={r.code} className="flex items-center gap-3">
                <Input
                  value={r.label}
                  maxLength={50}
                  onChange={(e) => update(i, { label: e.target.value })}
                  aria-label="Name der Strafe"
                  className="min-w-0 flex-1"
                />
                <AmountInput value={r.amount} onChange={(v) => update(i, { amount: v })} label={r.label} />
                <button
                  type="button"
                  aria-label={`${r.label} löschen`}
                  onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border border-border p-3">
            <Label htmlFor="new-penalty">Neue Strafe</Label>
            <div className="flex items-center gap-3">
              <Input
                id="new-penalty"
                placeholder="z. B. Wasser"
                value={newLabel}
                maxLength={50}
                onChange={(e) => setNewLabel(e.target.value)}
                className="min-w-0 flex-1"
              />
              <AmountInput value={newAmount} onChange={setNewAmount} label="Neue Strafe" />
              <Button type="button" size="icon" aria-label="Strafe hinzufügen" onClick={addRule}>
                <Plus />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={busy || !data} onClick={handleSave}>
            {busy ? "Speichere…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmountInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative w-24 shrink-0">
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Betrag ${label}`}
        className="pr-7 text-right"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
    </div>
  );
}
