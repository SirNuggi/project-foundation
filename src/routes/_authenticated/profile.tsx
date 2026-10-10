import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listMyGroups, createGroup } from "@/lib/groups.functions";
import { CreateGroupDialog } from "@/components/group/CreateGroupDialog";
import { GolfBagSection } from "@/components/profile/GolfBagSection";
import { SubNavigation, SlideViews, type SubNavItem } from "@/components/SubNavigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Pencil, Plus, Trash2, UserRound, Users, UsersRound } from "lucide-react";

import {
  createPassivePlayer,
  deletePassivePlayer,
  getMyProfile,
  listMyPassivePlayers,
  updateMyProfile,
  updatePassivePlayer,
} from "@/lib/golf.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNavigation } from "@/components/BottomNavigation";
import { Badge } from "@/components/ui/badge";
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
import {
  PassivePlayerDialog,
  type PassivePlayerFormValue,
} from "@/components/player/PassivePlayerDialog";

const profileTabs: SubNavItem[] = [
  { id: "me", label: "Ich", icon: UserRound },
  { id: "players", label: "Meine Spieler", icon: Users },
  { id: "groups", label: "Meine Gruppen", icon: UsersRound },
];

export const Route = createFileRoute("/_authenticated/profile")({

  head: () => ({
    meta: [
      { title: "Profil — Birdie Battle" },
      { name: "description", content: "Dein Golfprofil mit Anzeigename, Handicap und Abschlag." },
      { property: "og:title", content: "Profil — Birdie Battle" },
      { property: "og:description", content: "Dein Golfprofil in Birdie Battle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const fetchPassivePlayers = useServerFn(listMyPassivePlayers);
  const createPlayer = useServerFn(createPassivePlayer);
  const updatePlayer = useServerFn(updatePassivePlayer);
  const deletePlayer = useServerFn(deletePassivePlayer);

  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const { data: passivePlayers = [] } = useQuery({
    queryKey: ["my-passive-players"],
    queryFn: () => fetchPassivePlayers(),
  });

  const [tab, setTab] = useState("me");
  const [name, setName] = useState("");

  const [hcp, setHcp] = useState("-54,0");
  const [tee, setTee] = useState("Gelb");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const fetchGroups = useServerFn(listMyGroups);
  const addGroup = useServerFn(createGroup);
  const { data: groups = [] } = useQuery({ queryKey: ["my-groups"], queryFn: () => fetchGroups() });

  useEffect(() => {
    if (!data?.profile || loaded) return;
    setName(data.profile.display_name ?? "");
    setHcp(String(data.profile.handicap_index ?? -54).replace(".", ","));
    setTee((data.profile.default_tee ?? "herren") as "herren" | "damen");
    setLoaded(true);
  }, [data, loaded]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(hcp.replace(",", "."));
    if (!Number.isFinite(value) || value < -60 || value > 60) {
      toast.error("Handicap muss zwischen -60 und 60 liegen");
      return;
    }
    setSaving(true);
    try {
      await save({ data: { displayName: name.trim(), handicapIndex: value, defaultTee: tee } });
      toast.success("Profil gespeichert");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nicht gespeichert");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      await navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Abmelden fehlgeschlagen");
      setSigningOut(false);
    }
  }

  const editingPlayer = passivePlayers.find((player) => player.id === editingPlayerId) ?? null;
  const deletingPlayer = passivePlayers.find((player) => player.id === deletingPlayerId) ?? null;

  async function savePassivePlayer(value: PassivePlayerFormValue) {
    try {
      if (editingPlayerId) {
        await updatePlayer({
          data: {
            profileId: editingPlayerId,
            displayName: value.name,
            handicapIndex: value.handicapIndex,
            defaultTee: value.defaultTee,
          },
        });
        toast.success("Spieler aktualisiert");
      } else {
        await createPlayer({
          data: {
            displayName: value.name,
            handicapIndex: value.handicapIndex,
            defaultTee: value.defaultTee,
          },
        });
        toast.success("Spieler angelegt");
      }
      await queryClient.invalidateQueries({ queryKey: ["my-passive-players"] });
      await queryClient.invalidateQueries({ queryKey: ["player-search"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Spieler konnte nicht gespeichert werden");
      throw err;
    }
  }

  async function confirmDeletePlayer() {
    if (!deletingPlayerId) return;
    try {
      await deletePlayer({ data: { profileId: deletingPlayerId } });
      toast.success("Spieler gelöscht");
      setDeletingPlayerId(null);
      await queryClient.invalidateQueries({ queryKey: ["my-passive-players"] });
      await queryClient.invalidateQueries({ queryKey: ["player-search"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Spieler konnte nicht gelöscht werden");
    }
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="bg-secondary px-6 pb-8 pt-7 text-secondary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              GOLF BUDDIES
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Profil</h1>
          </div>
          <button
            type="button"
            aria-label="Abmelden"
            disabled={signingOut}
            onClick={signOut}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-destructive disabled:opacity-50"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <SubNavigation items={profileTabs} value={tab} onChange={setTab} />

      <SlideViews index={Math.max(0, profileTabs.findIndex((t) => t.id === tab))}>
        <form onSubmit={submit} className="space-y-6 px-6 pt-8 pb-4">
          <div className="space-y-2">
            <Label htmlFor="name">Anzeigename</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="h-13"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hcp">Handicap-Index</Label>
            <Input
              id="hcp"
              inputMode="decimal"
              value={hcp}
              onChange={(e) => setHcp(e.target.value)}
              className="h-13"
            />
            <p className="text-xs text-muted-foreground">Zum Beispiel -24,0 · Standard ist -54,0.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tee">Bevorzugter Abschlag</Label>
            <Input
              id="tee"
              value={tee}
              onChange={(e) => setTee(e.target.value)}
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

          <Button type="submit" disabled={saving} className="h-14 w-full text-base font-bold">
            {saving ? "Speichere…" : "Speichern"}
          </Button>
          {data?.profile && <GolfBagSection userId={data.profile.id} />}
        </form>

        <section className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black">Meine Spieler & Gäste</h2>
              <p className="text-sm text-muted-foreground">Dauerhafte Mitspieler ohne eigenes Konto</p>
            </div>
            <Button
              type="button"
              size="icon"
              aria-label="Neuen Spieler anlegen"
              onClick={() => {
                setEditingPlayerId(null);
                setPlayerDialogOpen(true);
              }}
            >
              <Plus />
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {passivePlayers.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                Noch keine passiven Spieler angelegt.
              </p>
            )}
            {passivePlayers.map((player) => (
              <div key={player.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{player.display_name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      HCP {String(player.handicap_index).replace(".", ",")}
                    </span>
                    <Badge variant="secondary">Passiv</Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`${player.display_name} bearbeiten`}
                  onClick={() => {
                    setEditingPlayerId(player.id);
                    setPlayerDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`${player.display_name} löschen`}
                  className="text-destructive"
                  onClick={() => setDeletingPlayerId(player.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black">Meine Gruppen</h2>
              <p className="text-sm text-muted-foreground">Gruppen, in denen du Mitglied bist</p>
            </div>
            <Button type="button" size="icon" aria-label="Neue Gruppe erstellen" onClick={() => setGroupDialogOpen(true)}>
              <Plus />
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {groups.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                Noch keine Gruppen.
              </p>
            )}
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
              >
                <p className="truncate font-bold">{g.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={g.role === "admin" ? "default" : "secondary"}>
                    {g.role === "admin" ? "Admin" : "Mitglied"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {g.memberCount} {g.memberCount === 1 ? "Mitglied" : "Mitglieder"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </SlideViews>


      <CreateGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSave={async (groupName) => {
          try {
            await addGroup({ data: { name: groupName } });
            toast.success("Gruppe erstellt");
            await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Gruppe konnte nicht erstellt werden");
            throw err;
          }
        }}
      />

      <PassivePlayerDialog
        open={playerDialogOpen}
        onOpenChange={(open) => {
          setPlayerDialogOpen(open);
          if (!open) setEditingPlayerId(null);
        }}
        initialValue={
          editingPlayer
            ? {
                name: editingPlayer.display_name,
                handicapIndex: editingPlayer.handicap_index,
                defaultTee: editingPlayer.default_tee ?? "Gelb",
              }
            : null
        }
        onSave={savePassivePlayer}
      />

      <AlertDialog open={!!deletingPlayerId} onOpenChange={(open) => !open && setDeletingPlayerId(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Spieler löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPlayer?.display_name ?? "Dieser Spieler"} wird aus deiner Spielerliste entfernt. Bereits gespielte Runden bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={confirmDeletePlayer}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BottomNavigation />
    </main>
  );
}
