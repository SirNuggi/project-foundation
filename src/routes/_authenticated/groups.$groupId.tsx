import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddGroupMemberDialog } from "@/components/group/AddGroupMemberDialog";
import { addGroupMember, getGroupDetail, removeGroupMember, renameGroup } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Gruppe — Golf Buddies" },
      { name: "description", content: "Mitglieder deiner Golfgruppe bei Golf Buddies verwalten." },
      { property: "og:title", content: "Gruppe — Golf Buddies" },
      { property: "og:description", content: "Mitglieder deiner Golfgruppe verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupPage,
});

type Member = NonNullable<Awaited<ReturnType<typeof getGroupDetail>>>["members"][number];

function GroupPage() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const fetchGroup = useServerFn(getGroupDetail);
  const addMember = useServerFn(addGroupMember);
  const removeMember = useServerFn(removeGroupMember);
  const rename = useServerFn(renameGroup);
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const key = ["group", groupId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => fetchGroup({ data: { groupId } }) });
  const isAdmin = data?.myRole === "admin";

  async function refresh() {
    await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ["my-groups"] });
  }

  async function handleAdd(profileId: string) {
    try {
      await addMember({ data: { groupId, profileId } });
      await refresh();
      toast.success("Mitglied hinzugefügt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hinzufügen");
      throw e;
    }
  }

  async function confirmRemove() {
    if (!toRemove) return;
    try {
      await removeMember({ data: { memberId: toRemove.id } });
      await refresh();
      toast.success("Mitglied entfernt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Entfernen");
    } finally {
      setToRemove(null);
    }
  }

  function openRenameDialog() {
    setRenameValue(data?.name ?? "");
    setRenameOpen(true);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name || !data || name === data.name) return;
    setRenaming(true);
    try {
      await rename({ data: { groupId, name } });
      await refresh();
      setRenameOpen(false);
      toast.success("Gruppe umbenannt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Umbenennen");
    } finally {
      setRenaming(false);
    }
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="relative bg-secondary px-6 pb-8 pt-7 text-secondary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">GOLF BUDDIES</p>
            <h1 className="mt-2 truncate text-3xl font-black tracking-tight">
              {isLoading ? "…" : (data?.name ?? "Gruppe nicht gefunden")}
            </h1>
          </div>
          {/* Geänderter Container: Spalten-Layout, nach rechts ausgerichtet, mit Abstand (gap-3) */}
{/* Geänderter Container: Absolut oben rechts positioniert, Spalten-Layout mit Abstand */}
<div className="absolute right-6 top-6 flex flex-col items-center gap-1">
  {/* Schließen-Button oben */}
  <Link to="/profile" aria-label="Zurück zum Profil" className="flex h-10 w-10 items-center justify-center">
    <X className="h-6 w-6" />
  </Link>

  {/* Dropdown-Menü direkt darunter */}
  {isAdmin && (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menü"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent"
      >
        <MoreVertical className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={openRenameDialog}>
          <Pencil className="mr-2 h-4 w-4" /> Umbenennen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )}
</div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Mitglied hinzufügen"
            className="absolute -bottom-8 left-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          >
            <Plus className="h-8 w-8" />
          </button>
        )}
      </header>

      <section className={`${isAdmin ? "mt-14" : "mt-8"} px-6`}>
        <p className="py-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Mitglieder{data ? ` (${data.members.length})` : ""}
        </p>
        <div className="mt-3 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {data?.members.map((m) => {
            const canRemove = isAdmin && m.userId !== data.createdBy && m.role !== "admin";
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{m.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">HCP {m.handicapIndex.toFixed(1).replace(".", ",")}</span>
                    <Badge variant={m.userType === "passive" ? "secondary" : "outline"}>
                      {m.userType === "passive" ? "Passiv" : "Aktiv"}
                    </Badge>
                    <Badge variant={m.role === "admin" ? "default" : "outline"}>
                      {m.role === "admin" ? "Admin" : "Mitglied"}
                    </Badge>
                  </div>
                </div>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => setToRemove(m)}
                    aria-label={`${m.name} entfernen`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-muted"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <AddGroupMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        memberIds={data?.members.map((m) => m.userId) ?? []}
        onAdd={handleAdd}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
          <form onSubmit={handleRename} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Gruppe umbenennen</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rename-group-name">Gruppenname</Label>
              <Input
                id="rename-group-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={50}
                autoFocus
                className="h-13"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={renaming || !renameValue.trim() || renameValue.trim() === data?.name}
              >
                {renaming ? "Speichere…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.name} wird aus der Gruppe entfernt. Der Spieler selbst bleibt erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
