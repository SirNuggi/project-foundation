import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPassivePlayer, searchPlayers } from "@/lib/golf.functions";

const fmt = (v: number) => v.toFixed(1).replace(".", ",");
function parseHcp(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(n) && n >= -60 && n <= 60 ? Math.round(n * 10) / 10 : null;
}

export function AddGroupMemberDialog({
  open,
  onOpenChange,
  memberIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  memberIds: string[];
  onAdd: (profileId: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const search = useServerFn(searchPlayers);
  const createPlayer = useServerFn(createPassivePlayer);
  const [tab, setTab] = useState("pick");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [hcp, setHcp] = useState("54,0");
  const [busy, setBusy] = useState(false);
  const q = query.trim();
  const { data: results, isFetching } = useQuery({
    queryKey: ["player-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: open && q.length !== 1,
  });
  const available = (results ?? []).filter((r) => !memberIds.includes(r.id));

  useEffect(() => {
    if (!open) return;
    setTab("pick");
    setQuery("");
    setName("");
    setHcp("54,0");
  }, [open]);

  async function pick(id: string) {
    setBusy(true);
    try {
      await onAdd(id);
      onOpenChange(false);
    } catch {
      /* toast by caller */
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    const value = parseHcp(hcp);
    if (!clean) return void toast.error("Bitte einen Namen eingeben");
    if (value === null) return void toast.error("Handicap muss zwischen -60 und 60 liegen");
    setBusy(true);
    try {
      const p = await createPlayer({ data: { displayName: clean, handicapIndex: value, defaultTee: "Gelb" } });
      await queryClient.invalidateQueries({ queryKey: ["player-search"] });
      await queryClient.invalidateQueries({ queryKey: ["my-passive-players"] });
      await onAdd(p.id);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Mitglied")) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>Mitglied hinzufügen</DialogTitle>
          <DialogDescription>Aktiven oder passiven Spieler wählen oder neu anlegen.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pick">Auswählen</TabsTrigger>
            <TabsTrigger value="new">Neu anlegen</TabsTrigger>
          </TabsList>
          <TabsContent value="pick" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Spieler suchen" className="h-13 pl-11" maxLength={50} />
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {!isFetching && available.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground">
                  Kein Spieler gefunden.{" "}
                  <button type="button" className="font-bold text-foreground underline" onClick={() => { setName(q); setTab("new"); }}>
                    Neu anlegen
                  </button>
                </p>
              )}
              {available.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pick(r.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.display_name}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">HCP {fmt(r.handicap_index)}</span>
                      <Badge variant={r.user_type === "passive" ? "secondary" : "outline"}>
                        {r.user_type === "passive" ? "Passiv" : "Aktiv"}
                      </Badge>
                    </span>
                  </span>
                  <UserPlus className="h-5 w-5 text-primary" />
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="new">
            <form onSubmit={create} className="space-y-4">
              <p className="text-xs text-muted-foreground">Passiver Spieler – bleibt ohne eigenes Konto gespeichert.</p>
              <div className="space-y-2">
                <Label htmlFor="gm-name">Name</Label>
                <Input id="gm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="h-13" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gm-hcp">Handicap</Label>
                <Input id="gm-hcp" inputMode="decimal" value={hcp} onChange={(e) => setHcp(e.target.value)} className="h-13" />
                <p className="text-xs text-muted-foreground">Zum Beispiel -24,0 · Standard ist 54,0.</p>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                <Button type="submit" disabled={busy}>{busy ? "Speichere…" : "Anlegen & hinzufügen"}</Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
