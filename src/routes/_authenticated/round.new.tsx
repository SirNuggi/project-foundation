import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, UserPlus, Users, X } from "lucide-react";
import {
  createPassivePlayer,
  createRound,
  getMyProfile,
  listCourses,
  searchPlayers,
} from "@/lib/golf.functions";
import { listMyGroups, getGroupDetail } from "@/lib/groups.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TeeBoxRows,
  defaultTeeBoxDrafts,
  parseTeeBoxes,
  type TeeBoxDraft,
} from "@/components/course/TeeBoxRows";

export const Route = createFileRoute("/_authenticated/round/new")({
  head: () => ({
    meta: [
      { title: "Neue Runde — Birdie Battle" },
      {
        name: "description",
        content: "Golfplatz wählen, Mitspieler hinzufügen und die Runde starten.",
      },
      { property: "og:title", content: "Neue Runde — Birdie Battle" },
      { property: "og:description", content: "Platz wählen, Mitspieler hinzufügen, losspielen." },
    ],
  }),
  component: NewRound,
});

type TeeOption = { id: string | null; name: string };
type SelectedPlayer = {
  key: string;
  name: string;
  profileId?: string | undefined;
  teeName: string | null;
  handicapIndex: number;
  userType?: ("active" | "passive") | undefined;
  isMe?: boolean | undefined;
};
type FlightDraft = { key: string; players: SelectedPlayer[] };
type GroupMember = {
  id: string;
  userId: string;
  role: "admin" | "member";
  name: string;
  handicapIndex: number;
  userType: "active" | "passive";
};

const NEW_COURSE = "__new__";

const MAX_PER_FLIGHT = 4;

function formatHcp(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function parseHcp(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(n) && n >= -60 && n <= 60 ? Math.round(n * 10) / 10 : null;
}

function TeeSelect({
  options,
  value,
  onChange,
  label,
}: {
  options: TeeOption[];
  value: string | null;
  onChange: (name: string) => void;
  label: string;
}) {
  if (options.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger aria-label={label} className="h-13 w-full">
          <SelectValue placeholder="Erst Platz wählen" />
        </SelectTrigger>
      </Select>
    );
  }
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-13 w-full font-bold">
        <SelectValue placeholder="Abschlag" />
      </SelectTrigger>
      <SelectContent>
        {options.map((t) => (
          <SelectItem key={t.name} value={t.name}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TypeBadge({ p }: { p: SelectedPlayer }) {
  const label = p.isMe ? "Aktiv" : !p.profileId ? "Gast" : p.userType === "passive" ? "Passiv" : "Aktiv";
  return <Badge variant={label === "Aktiv" ? "outline" : "secondary"}>{label}</Badge>;
}

function PlayerEditDialog({
  player,
  teeOptions,
  pickTee,
  onClose,
  onSave,
}: {
  player: SelectedPlayer | null;
  teeOptions: TeeOption[];
  pickTee: (preferred: string | null | undefined) => string | null;
  onClose: () => void;
  onSave: (patch: Partial<SelectedPlayer>) => void;
}) {
  const [hcp, setHcp] = useState("");
  const [tee, setTee] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    setHcp(formatHcp(player.handicapIndex));
    setTee(pickTee(player.teeName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const value = parseHcp(hcp);
    if (value === null) {
      toast.error("Handicap muss zwischen -60 und 60 liegen");
      return;
    }
    onSave({ handicapIndex: value, teeName: tee });
    onClose();
  }

  return (
    <Dialog open={!!player} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
        <form onSubmit={save} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{player?.name}</DialogTitle>
            <DialogDescription>Handicap und Abschlag nur für diese Runde.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-hcp">Handicap</Label>
            <Input
              id="edit-hcp"
              inputMode="decimal"
              value={hcp}
              onChange={(e) => setHcp(e.target.value)}
              className="h-13"
            />
            <p className="text-xs text-muted-foreground">Zum Beispiel -24,0</p>
          </div>
          <div className="space-y-2">
            <Label>Abschlag</Label>
            <TeeSelect options={teeOptions} value={tee} onChange={setTee} label="Abschlag" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit">Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddPlayerDialog({
  open,
  onOpenChange,
  teeOptions,
  pickTee,
  takenProfileIds,
  groupMembers,
  groupName,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teeOptions: TeeOption[];
  pickTee: (preferred: string | null | undefined) => string | null;
  takenProfileIds: string[];
  groupMembers?: GroupMember[] | undefined;
  groupName?: string | undefined;
  onAdd: (p: SelectedPlayer) => boolean;
}) {
  const queryClient = useQueryClient();
  const search = useServerFn(searchPlayers);
  const createPlayer = useServerFn(createPassivePlayer);
  const [tab, setTab] = useState("pick");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"passive" | "guest">("passive");
  const [name, setName] = useState("");
  const [hcp, setHcp] = useState("54,0");
  const [tee, setTee] = useState("Gelb");
  const [saving, setSaving] = useState(false);
  const q = query.trim();
  const { data: results, isFetching } = useQuery({
    queryKey: ["player-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: open && q.length !== 1,
  });

  useEffect(() => {
    if (!open) return;
    setTab("pick");
    setQuery("");
    setKind("passive");
    setName("");
    setHcp("54,0");
    setTee(teeOptions[0]?.name ?? "Gelb");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groupMemberUserIds = new Set((groupMembers ?? []).map((m) => m.userId));

  // Build the unified list of players to show
  type PlayerItem = {
    id: string;
    display_name: string;
    handicap_index: number;
    default_tee: string;
    user_type: "active" | "passive";
    isGroupMember: boolean;
  };

  let displayedPlayers: PlayerItem[] = [];

  if (q) {
    displayedPlayers = (results ?? [])
      .map((r) => ({
        id: r.id,
        display_name: r.display_name,
        handicap_index: r.handicap_index,
        default_tee: r.default_tee,
        user_type: (r.user_type === "passive" ? "passive" : "active") as "active" | "passive",
        isGroupMember: groupMemberUserIds.has(r.id),
      }))
      .sort((a, b) => {
        if (a.isGroupMember && !b.isGroupMember) return -1;
        if (!a.isGroupMember && b.isGroupMember) return 1;
        return 0;
      });
  } else {
    // When no search term: list group members first, then other suggested players
    const seenIds = new Set<string>();
    for (const gm of groupMembers ?? []) {
      seenIds.add(gm.userId);
      displayedPlayers.push({
        id: gm.userId,
        display_name: gm.name,
        handicap_index: gm.handicapIndex,
        default_tee: "Gelb",
        user_type: gm.userType,
        isGroupMember: true,
      });
    }
    for (const r of results ?? []) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        displayedPlayers.push({
          id: r.id,
          display_name: r.display_name,
          handicap_index: r.handicap_index,
          default_tee: r.default_tee,
          user_type: (r.user_type === "passive" ? "passive" : "active") as "active" | "passive",
          isGroupMember: false,
        });
      }
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const value = parseHcp(hcp);
    if (!cleanName) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }
    if (value === null) {
      toast.error("Handicap muss zwischen -60 und 60 liegen");
      return;
    }
    if (kind === "guest") {
      if (onAdd({ key: `guest-${Date.now()}`, name: cleanName, teeName: pickTee(tee), handicapIndex: value })) {
        onOpenChange(false);
      }
      return;
    }
    setSaving(true);
    try {
      const player = await createPlayer({
        data: { displayName: cleanName, handicapIndex: value, defaultTee: tee.trim().slice(0, 30) || "Gelb" },
      });
      onAdd({
        key: player.id,
        name: player.display_name,
        profileId: player.id,
        teeName: pickTee(player.default_tee),
        handicapIndex: player.handicap_index,
        userType: "passive",
      });
      await queryClient.invalidateQueries({ queryKey: ["player-search"] });
      await queryClient.invalidateQueries({ queryKey: ["my-passive-players"] });
      toast.success("Spieler angelegt und hinzugefügt");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Spieler konnte nicht angelegt werden");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>Spieler hinzufügen</DialogTitle>
          <DialogDescription>Bestehenden Spieler wählen oder neu anlegen.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pick">Auswählen</TabsTrigger>
            <TabsTrigger value="new">Neu anlegen</TabsTrigger>
          </TabsList>
          <TabsContent value="pick" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Spieler suchen (Name oder Handle)"
                className="h-13 pl-11"
                maxLength={50}
              />
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {!isFetching && displayedPlayers.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground">
                  Kein Spieler gefunden.{" "}
                  <button type="button" className="font-bold text-foreground underline" onClick={() => { setName(q); setTab("new"); }}>
                    Neu anlegen
                  </button>
                </p>
              )}
              {displayedPlayers.map((r) => {
                const taken = takenProfileIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={taken}
                    onClick={() => {
                      const ok = onAdd({
                        key: r.id,
                        name: r.display_name,
                        profileId: r.id,
                        teeName: pickTee(r.default_tee),
                        handicapIndex: r.handicap_index,
                        userType: r.user_type === "passive" ? "passive" : "active",
                      });
                      if (ok) onOpenChange(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.display_name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">HCP {formatHcp(r.handicap_index)}</span>
                        <Badge variant={r.user_type === "passive" ? "secondary" : "outline"}>
                          {r.user_type === "passive" ? "Passiv" : "Aktiv"}
                        </Badge>
                        {r.isGroupMember && (
                          <Badge variant="default" className="text-[10px]">
                            {groupName ? groupName : "Gruppe"}
                          </Badge>
                        )}
                      </span>
                    </span>
                    <UserPlus className="h-5 w-5 text-primary" />
                  </button>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="new">
            <form onSubmit={create} className="space-y-4">
              <div className="flex h-11 overflow-hidden rounded-xl border border-border">
                {(
                  [
                    ["passive", "Passiver Spieler"],
                    ["guest", "Gast"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex-1 text-sm font-bold ${kind === k ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {kind === "passive"
                  ? "Bleibt ohne eigenes Konto für weitere Runden gespeichert."
                  : "Nur für diese Runde, wird nicht gespeichert."}
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-player-name">Name</Label>
                <Input id="new-player-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="h-13" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-player-hcp">Handicap</Label>
                <Input id="new-player-hcp" inputMode="decimal" value={hcp} onChange={(e) => setHcp(e.target.value)} className="h-13" />
              </div>
              <div className="space-y-2">
                <Label>{kind === "passive" ? "Bevorzugter Abschlag" : "Abschlag"}</Label>
                {kind === "guest" ? (
                  <TeeSelect options={teeOptions} value={pickTee(tee)} onChange={setTee} label="Abschlag" />
                ) : (
                  <>
                    <Input value={tee} onChange={(e) => setTee(e.target.value)} maxLength={30} placeholder="Gelb" className="h-13" />
                    <div className="flex flex-wrap gap-2">
                      {["Gelb", "Rot", "Weiß", "Blau"].map((o) => (
                        <button key={o} type="button" onClick={() => setTee(o)} className="rounded-lg border border-border px-3 py-1 text-xs font-bold">
                          {o}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Speichere…" : "Hinzufügen"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function FlightSection({
  index,
  players,
  teeOptions,
  pickTee,
  takenProfileIds,
  groupMembers,
  groupName,
  onAdd,
  onUpdate,
  onRemovePlayer,
  onRemoveFlight,
}: {
  index: number;
  players: SelectedPlayer[];
  teeOptions: TeeOption[];
  pickTee: (preferred: string | null | undefined) => string | null;
  takenProfileIds: string[];
  groupMembers?: GroupMember[] | undefined;
  groupName?: string | undefined;
  onAdd: (p: SelectedPlayer) => boolean;
  onUpdate: (key: string, patch: Partial<SelectedPlayer>) => void;
  onRemovePlayer: (key: string) => void;
  onRemoveFlight: (() => void) | null;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<SelectedPlayer | null>(null);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-black">Flight {index + 1}</Label>
        {onRemoveFlight && (
          <button
            type="button"
            onClick={onRemoveFlight}
            aria-label={`Flight ${index + 1} entfernen`}
            className="text-xs font-bold text-muted-foreground"
          >
            entfernen
          </button>
        )}
      </div>

      <div className="space-y-2">
        {players.map((p) => {
          const tee = pickTee(p.teeName);
          return (
            <div
              key={p.key}
              role="button"
              tabIndex={0}
              onClick={() => setEditing(p)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(p)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted active:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{p.name}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    HCP {formatHcp(p.handicapIndex)}
                    {tee ? ` · ${tee}` : ""}
                  </span>
                  <TypeBadge p={p} />
                </span>
              </span>
              {!p.isMe && (
                <button
                  type="button"
                  aria-label={`${p.name} entfernen`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(p.key);
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        {players.length < MAX_PER_FLIGHT && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              aria-label="Spieler hinzufügen"
              onClick={() => setAddOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      <AddPlayerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        teeOptions={teeOptions}
        pickTee={pickTee}
        takenProfileIds={takenProfileIds}
        groupMembers={groupMembers}
        groupName={groupName}
        onAdd={onAdd}
      />
      <PlayerEditDialog
        player={editing}
        teeOptions={teeOptions}
        pickTee={pickTee}
        onClose={() => setEditing(null)}
        onSave={(patch) => editing && onUpdate(editing.key, patch)}
      />
    </div>
  );
}

function NewRound() {
  const navigate = useNavigate();
  const fetchCourses = useServerFn(listCourses);
  const fetchProfile = useServerFn(getMyProfile);
  const fetchMyGroups = useServerFn(listMyGroups);
  const fetchGroupDetail = useServerFn(getGroupDetail);
  const submitRound = useServerFn(createRound);

  const [roundName, setRoundName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [teeRows, setTeeRows] = useState<TeeBoxDraft[]>(() => defaultTeeBoxDrafts());
  const [pars, setPars] = useState<number[]>(() => Array.from({ length: 18 }, () => 4));
  const [sis, setSis] = useState<number[]>(() => Array.from({ length: 18 }, (_, i) => i + 1));
  const [sisBack, setSisBack] = useState<number[]>(() =>
    Array.from({ length: 9 }, (_, i) => i + 10),
  );
  const [courseHoles, setCourseHoles] = useState<9 | 18>(18);

  const [playedOn, setPlayedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [withPenalties, setWithPenalties] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [myTee, setMyTee] = useState<string | null>(null);
  const [myHandicap, setMyHandicap] = useState<number | null>(null);
  const [flights, setFlights] = useState<FlightDraft[]>([{ key: "f1", players: [] }]);
  const [saving, setSaving] = useState(false);
  const [penaltyFundAvailable, setPenaltyFundAvailable] = useState(false);
  const [penaltyFundHint, setPenaltyFundHint] = useState("");

  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: () => fetchCourses() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const { data: groups } = useQuery({ queryKey: ["my-groups"], queryFn: () => fetchMyGroups() });
  const { data: selectedGroupDetail } = useQuery({
      queryKey: ["group-detail", groupId],
      queryFn: () => (groupId ? fetchGroupDetail({ data: { groupId } }) : null),
      enabled: !!groupId,
    });
  
    // Prüfe, ob die ausgewählte Gruppe eine aktive Strafkasse hat
    useEffect(() => {
      async function loadPenaltyFundStatus() {
        if (!groupId) {
          setPenaltyFundAvailable(false);
          setPenaltyFundHint("Strafkasse ist nur verfügbar, wenn eine Gruppe mit aktivierter Strafkasse ausgewählt ist.");
          return;
        }
        try {
          const groupData = await fetchGroupDetail({ data: { groupId } });
          const hasPenaltyFund = groupData?.hasPenaltyFund ?? false;
          setPenaltyFundAvailable(hasPenaltyFund);
          if (!hasPenaltyFund) {
            setPenaltyFundHint("Strafkasse ist nur verfügbar, wenn eine Gruppe mit aktivierter Strafkasse ausgewählt ist.");
          } else {
            setPenaltyFundHint("");
          }
        } catch (e) {
          setPenaltyFundAvailable(false);
          setPenaltyFundHint("Fehler beim Laden der Gruppen-Informationen.");
        }
      }
      loadPenaltyFundStatus();
    }, [groupId, fetchGroupDetail]);

  const takenProfileIds = [
    ...(me?.profile?.id ? [me.profile.id] : []),
    ...flights
      .flatMap((f) => f.players)
      .map((p) => p.profileId)
      .filter((id): id is string => !!id),
  ];

  const selectedCourse = courses?.find((c) => c.id === courseId) ?? null;
  const teeOptions: TeeOption[] = creatingCourse
    ? parseTeeBoxes(teeRows).map((t) => ({ id: null, name: t.name }))
    : (selectedCourse?.teeBoxes ?? []).map((t) => ({ id: t.id, name: t.name }));

  function teeIdFor(name: string | null) {
    if (!name) return null;
    return teeOptions.find((t) => t.name === name)?.id ?? null;
  }

  function pickTee(preferred: string | null | undefined): string | null {
    if (preferred && teeOptions.some((t) => t.name.toLowerCase() === preferred.toLowerCase())) {
      return teeOptions.find((t) => t.name.toLowerCase() === preferred.toLowerCase())?.name ?? null;
    }
    return teeOptions[0]?.name ?? null;
  }

  const effectiveMyTee = pickTee(myTee ?? me?.profile?.default_tee ?? null);
  const mePlayer: SelectedPlayer = {
    key: "__me__",
    name: me?.profile?.display_name ? `${me.profile.display_name} (Du)` : "Du",
    profileId: me?.profile?.id,
    teeName: effectiveMyTee,
    handicapIndex: myHandicap ?? Number(me?.profile?.handicap_index ?? 54),
    isMe: true,
  };

  function addPlayer(flightKey: string, p: SelectedPlayer): boolean {
    const flight = flights.find((f) => f.key === flightKey);
    const limit = flightKey === flights[0]?.key ? MAX_PER_FLIGHT - 1 : MAX_PER_FLIGHT;
    if ((flight?.players.length ?? 0) >= limit) {
      toast.error(`Maximal ${MAX_PER_FLIGHT} Spieler pro Flight`);
      return false;
    }
    if (flights.some((f) => f.players.some((x) => x.key === p.key))) {
      toast.error("Dieser Spieler ist bereits eingeteilt");
      return false;
    }
    setFlights((prev) =>
      prev.map((f) => (f.key === flightKey ? { ...f, players: [...f.players, p] } : f)),
    );
    return true;
  }

  function updatePlayer(flightKey: string, key: string, patch: Partial<SelectedPlayer>) {
    setFlights(
      flights.map((f) =>
        f.key === flightKey
          ? { ...f, players: f.players.map((x) => (x.key === key ? { ...x, ...patch } : x)) }
          : f,
      ),
    );
  }

  function removePlayer(flightKey: string, key: string) {
    setFlights(
      flights.map((f) =>
        f.key === flightKey ? { ...f, players: f.players.filter((x) => x.key !== key) } : f,
      ),
    );
  }

  async function start() {
    if (creatingCourse && newName.trim().length < 2) {
      toast.error("Bitte einen Platznamen eingeben");
      return;
    }
    if (!creatingCourse && !courseId) {
      toast.error("Bitte einen Golfplatz wählen");
      return;
    }
    const emptyFlight = flights.findIndex((f, i) => i > 0 && f.players.length === 0);
    if (emptyFlight > 0) {
      toast.error(`Flight ${emptyFlight + 1} braucht mindestens einen Spieler`);
      return;
    }
    setSaving(true);
    try {
      const result = await submitRound({
        data: {
          name: roundName.trim() ? roundName.trim().slice(0, 100) : null,
          groupId: groupId,
          courseId: creatingCourse ? null : courseId,
          courseName: creatingCourse ? newName.trim() : courseName.trim().slice(0, 100),
          newCourse: creatingCourse
            ? {
                name: newName.trim(),
                city: newCity.trim(),
                holeCount: courseHoles,
                teeBoxes: parseTeeBoxes(teeRows),
                holes: Array.from({ length: courseHoles }, (_, i) => ({
                  holeNumber: i + 1,
                  par: pars[i] ?? 4,
                  strokeIndex: sis[i] ?? i + 1,
                  strokeIndexBack: courseHoles === 9 ? (sisBack[i] ?? null) : null,
                })),
              }
            : null,
          playedOn,
          holeCount,
          withPenalties,
          myTeeBoxId: teeIdFor(effectiveMyTee),
          myTeeName: effectiveMyTee,
          myHandicapIndex: myHandicap,
          flights: flights.map((f) => ({
            players: f.players.map((p) => {
              const teeName = pickTee(p.teeName);
              const base = {
                teeBoxId: teeIdFor(teeName),
                teeName,
                handicapIndex: p.handicapIndex,
              };
              return p.profileId
                ? { profileId: p.profileId, ...base }
                : { guestName: p.name, ...base };
            }),
          })),
        },
      });
      navigate({ to: "/round/$roundId", params: { roundId: result.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Runde konnte nicht gestartet werden");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background pb-32">
      <header className="relative bg-secondary px-6 pb-8 pt-7 text-secondary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">GOLF BUDDIES</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Neue Runde</h1>
          </div>
          <Link
            to="/dashboard"
            aria-label="Zurück zum Dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full active:scale-95"
          >
            <X className="h-6 w-6" />
          </Link>
        </div>
      </header>

      <div className="space-y-6 px-6 pt-8">
        <div className="space-y-2">
          <Label htmlFor="round-name">Rundenname (optional)</Label>
          <Input
            id="round-name"
            className="h-13"
            placeholder="z. B. Dienstagsrunde"
            maxLength={100}
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="course">Golfplatz</Label>
          <Select
            value={creatingCourse ? NEW_COURSE : (courseId ?? "")}
            onValueChange={(id) => {
              if (id === NEW_COURSE) {
                setCreatingCourse(true);
                setCourseId(null);
                return;
              }
              const c = courses?.find((x) => x.id === id);
              if (!c) return;
              setCreatingCourse(false);
              setCourseId(c.id);
              setCourseName(c.name);
              setHoleCount(c.hole_count === 9 ? 9 : 18);
            }}
          >
            <SelectTrigger id="course" className="h-13">
              <SelectValue placeholder="Golfplatz wählen" />
            </SelectTrigger>
            <SelectContent>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` · ${c.city}` : ""}
                </SelectItem>
              ))}
              <SelectItem value={NEW_COURSE}>+ Neuer Platz</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {creatingCourse && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">
              Dieser Platz ist neu! Bitte gib kurz die Par-Werte und den Stroke-Index (Vorgabe 1–18)
              für die Löcher ein.
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                className="h-13"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-city">Ort</Label>
              <Input
                id="new-city"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                maxLength={80}
                className="h-13"
              />
            </div>
            <TeeBoxRows rows={teeRows} onChange={setTeeRows} idPrefix="new-tee" />

            <div className="space-y-2">
              <Label>Löcher des Platzes</Label>
              <div className="flex h-13 overflow-hidden rounded-xl border border-border">
                {([9, 18] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCourseHoles(n)}
                    className={`flex-1 text-sm font-bold ${
                      courseHoles === n ? "bg-primary text-primary-foreground" : "bg-card"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Par je Loch</Label>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: courseHoles }, (_, i) => (
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
              <Label>
                {courseHoles === 9 ? "Stroke-Index Hinrunde (Loch 1–9)" : "Stroke-Index je Loch"}
              </Label>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: courseHoles }, (_, i) => (
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

            {courseHoles === 9 && (
              <div className="space-y-2">
                <Label>Stroke-Index Rückrunde (Loch 10–18)</Label>
                <p className="text-xs text-muted-foreground">
                  Gilt, wenn dieser Platz als 18-Loch-Runde gespielt wird.
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
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              value={playedOn}
              onChange={(e) => setPlayedOn(e.target.value)}
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
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4">
          <div className="pr-4">
            <Label htmlFor="with-penalties" className="text-base font-black">
              Mit Strafkasse spielen
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Aus: keine Strafen-Chips, kein Geld — nur Schläge, Putts und Stableford.
            </p>
          </div>
          <div className="flex items-center">
            <Switch
              id="with-penalties"
              checked={withPenalties}
              onCheckedChange={setWithPenalties}
              disabled={!penaltyFundAvailable}
              aria-disabled={!penaltyFundAvailable}
            />
            {penaltyFundAvailable ? null : (
              <span className="ml-3 text-xs text-muted-foreground">
                {penaltyFundHint}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-select">Gruppe</Label>
          <Select
            value={groupId ?? "none"}
            onValueChange={(val) => setGroupId(val === "none" ? null : val)}
          >
            <SelectTrigger id="group-select" className="h-13">
              <SelectValue placeholder="Gruppe wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Gruppe</SelectItem>
              {groups?.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {flights.map((f, i) => (
            <FlightSection
              key={f.key}
              index={i}
              players={i === 0 ? [mePlayer, ...f.players] : f.players}
              teeOptions={teeOptions}
              pickTee={pickTee}
              takenProfileIds={takenProfileIds}
              groupMembers={selectedGroupDetail?.members}
              groupName={selectedGroupDetail?.name}
              onAdd={(p) => addPlayer(f.key, p)}
              onUpdate={(key, patch) => {
                if (key === mePlayer.key) {
                  if (patch.handicapIndex !== undefined) setMyHandicap(patch.handicapIndex);
                  if (patch.teeName !== undefined) setMyTee(patch.teeName);
                } else updatePlayer(f.key, key, patch);
              }}
              onRemovePlayer={(key) => removePlayer(f.key, key)}
              onRemoveFlight={
                i === 0 ? null : () => setFlights(flights.filter((x) => x.key !== f.key))
              }
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="h-13 w-full font-bold"
            onClick={() =>
              setFlights([...flights, { key: `f${Date.now()}`, players: [] }])
            }
          >
            + Weiteren Flight hinzufügen
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <Button
          onClick={start}
          disabled={saving}
          size="lg"
          className="h-14 w-full text-base font-bold"
        >
          {saving ? "Runde wird angelegt…" : "Runde starten"}
        </Button>
      </div>
    </main>
  );
}
