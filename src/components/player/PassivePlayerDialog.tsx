import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PassivePlayerFormValue = {
  name: string;
  handicapIndex: number;
  defaultTee: string;
};

export function PassivePlayerDialog({
  open,
  onOpenChange,
  initialValue,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: PassivePlayerFormValue | null;
  onSave: (value: PassivePlayerFormValue) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("54,0");
  const [tee, setTee] = useState("Gelb");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialValue?.name ?? "");
    setHandicap(
      (initialValue?.handicapIndex ?? 54).toFixed(1).replace(".", ","),
    );
    setTee(initialValue?.defaultTee?.trim() || "Gelb");
  }, [initialValue, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanTee = tee.trim();
    const handicapIndex = Number(handicap.replace(",", "."));
    if (!cleanName) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }
    if (!Number.isFinite(handicapIndex) || handicapIndex < -60 || handicapIndex > 60) {
      toast.error("Handicap muss zwischen -60 und 60 liegen");
      return;
    }
    if (!cleanTee) {
      toast.error("Bitte einen Abschlag eingeben");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: cleanName,
        handicapIndex,
        defaultTee: cleanTee.slice(0, 30),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{initialValue ? "Spieler bearbeiten" : "Passiven Spieler anlegen"}</DialogTitle>
            <DialogDescription>
              Dieser Spieler braucht kein eigenes Konto und bleibt für weitere Runden gespeichert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="passive-player-name">Name</Label>
            <Input id="passive-player-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} className="h-13" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passive-player-handicap">Handicap</Label>
            <Input id="passive-player-handicap" inputMode="decimal" value={handicap} onChange={(event) => setHandicap(event.target.value)} className="h-13" />
            <p className="text-xs text-muted-foreground">Zum Beispiel -24,0 · Standard ist 54,0.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="passive-player-tee">Bevorzugter Abschlag</Label>
            <Input
              id="passive-player-tee"
              value={tee}
              onChange={(event) => setTee(event.target.value)}
              maxLength={30}
              placeholder="Gelb"
              className="h-13"
            />
            <div className="flex flex-wrap gap-2">
              {["Gelb", "Rot", "Weiß", "Blau"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTee(option)}
                  className="rounded-lg border border-border px-3 py-1 text-xs font-bold"
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Wird beim Rundenstart vorausgewählt, wenn der Platz diesen Abschlag hat.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>{saving ? "Speichere…" : "Speichern"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
