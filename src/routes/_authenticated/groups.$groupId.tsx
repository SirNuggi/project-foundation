import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Coins, Info, Plus, Settings, Trash2, Users, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GroupPenaltyRulesDialog } from "@/components/group/GroupPenaltyRulesDialog";
import { SubNavigation, SlideViews, type SubNavItem } from "@/components/SubNavigation";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MemberFinancialCard } from "@/components/group/MemberFinancialCard";
import {
  addGroupMember,
  getGroupDetail,
  getGroupFinancialOverview,
  removeGroupMember,
  renameGroup,
  updateGroupFund,
} from "@/lib/groups.functions";

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

const baseTabs: SubNavItem[] = [
  { id: "members", label: "Mitglieder", icon: Users },
  { id: "settings", label: "Einstellungen", icon: Settings },
];
const fundTab: SubNavItem = { id: "fund", label: "Kasse", icon: Coins };

function GroupPage() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const fetchGroup = useServerFn(getGroupDetail);
  const addMember = useServerFn(addGroupMember);
  const removeMember = useServerFn(removeGroupMember);
  const rename = useServerFn(renameGroup);
  const [tab, setTab] = useState("members");
  const [addOpen, setAddOpen] = useState(false);

  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [groupName, setGroupName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const key = ["group", groupId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => fetchGroup({ data: { groupId } }) });
    const { data: financialData, isLoading: financialLoading } = useQuery({
      queryKey: ["group-financial", groupId],
      queryFn: () => fetchFinancialOverview({ data: { groupId } }),
      enabled: hasFund,
    });
    const isAdmin = data?.myRole === "admin";
  const updateFund = useServerFn(updateGroupFund);
  const fetchFinancialOverview = useServerFn(getGroupFinancialOverview);
  const recordPayment = useServerFn(recordGroupPayment);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fee, setFee] = useState("0,00");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMember, setPaymentMember] = useState<FinancialMember | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"penalty" | "membership_fee">("penalty");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const hasFund = !!data?.hasPenaltyFund;
  const groupTabs = hasFund ? [...baseTabs, fundTab] : baseTabs;

  useEffect(() => {
    if (data) setFee(data.membershipFee.toFixed(2).replace(".", ","));
  }, [data?.membershipFee]);

  useEffect(() => {
    if (!hasFund && tab === "fund") setTab("settings");
  }, [hasFund, tab]);

  async function toggleFund(v: boolean) {
    qc.setQueryData(key, (old: typeof data) => (old ? { ...old, hasPenaltyFund: v } : old));
    try {
      await updateFund({ data: { groupId, hasPenaltyFund: v } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
    await refresh();
  }

  async function saveFee() {
    const n = Number(fee.trim().replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 9999.99) {
      toast.error("Ungültiger Betrag");
      return;
    }
    if (data && Math.abs(n - data.membershipFee) < 0.001) return;
    try {
      await updateFund({ data: { groupId, membershipFee: n } });
      await refresh();
      toast.success("Mitgliedsbeitrag gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  useEffect(() => {
    if (!data?.name || loaded) return;
    setGroupName(data.name);
    setLoaded(true);
  }, [data, loaded]);

  async function refresh() {
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["my-groups"] });
      await qc.invalidateQueries({ queryKey: ["group-financial", groupId] });
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

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const name = groupName.trim();
    if (!name || !data || name === data.name) return;
    setRenaming(true);
    try {
      await rename({ data: { groupId, name } });
      await refresh();
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
          <div className="absolute right-6 top-5">
            <Link to="/profile" aria-label="Zurück zum Profil" className="flex h-10 w-10 items-center justify-center">
              <X className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </header>

      <SubNavigation items={groupTabs} value={tab} onChange={setTab} />

      <SlideViews
        index={Math.max(
          0,
          groupTabs.findIndex((t) => t.id === tab),
        )}
      >
        <section className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black">Mitglieder{data ? ` (${data.members.length})` : ""}</h2>
              <p className="text-sm text-muted-foreground">Mitglieder dieser Gruppe</p>
            </div>
            {isAdmin && (
              <Button type="button" size="icon" aria-label="Mitglied hinzufügen" onClick={() => setAddOpen(true)}>
                <Plus />
              </Button>
            )}
          </div>
          <div className="mt-5 space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
            {data?.members.map((m) => {
              const canRemove = isAdmin && m.userId !== data.createdBy && m.role !== "admin";
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{m.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        HCP {m.handicapIndex.toFixed(1).replace(".", ",")}
                      </span>
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

        <section className="px-6 pt-8 pb-4">
          <h2 className="text-xl font-black">Einstellungen</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gruppeneinstellungen verwalten</p>
          {isAdmin ? (
            <form onSubmit={handleRename} className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="group-name">Gruppenname</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={50}
                  className="h-13"
                />
              </div>
              <Button
                type="submit"
                disabled={renaming || !groupName.trim() || groupName.trim() === data?.name}
                className="h-14 w-full text-base font-bold"
              >
                {renaming ? "Speichere…" : "Speichern"}
              </Button>
            </form>
          ) : (
            <div className="mt-6 space-y-2">
              <Label>Gruppenname</Label>
              <p className="text-base font-bold">{data?.name ?? "—"}</p>
            </div>
          )}
          <div className="mt-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="penalty-fund" className="text-base font-bold">
                Mit Strafkasse spielen
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Info zur Strafkasse" className="text-primary">
                    <Info className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">
                  Aktiviert die Strafkasse für Runden dieser Gruppe. Es können Mitgliedsbeiträge und individuelle
                  Strafen hinterlegt werden.
                </PopoverContent>
              </Popover>
            </div>
            <Switch id="penalty-fund" checked={hasFund} disabled={!isAdmin} onCheckedChange={toggleFund} />
          </div>
          {hasFund && (
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="membership-fee">Mitgliedsbeitrag (€)</Label>
                <div className="relative">
                  <Input
                    id="membership-fee"
                    inputMode="decimal"
                    value={fee}
                    disabled={!isAdmin}
                    onChange={(e) => setFee(e.target.value)}
                    onBlur={saveFee}
                    className="h-13 pr-9"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>
              {isAdmin && (
                <Button type="button" variant="outline" className="h-14 w-full text-base font-bold" onClick={() => setRulesOpen(true)}>
                  Strafen festlegen
                </Button>
              )}
            </div>
          )}
        </section>
        {hasFund ? (
          <section className="px-6 pt-8 pb-4">
            <h2 className="text-xl font-black">Kasse</h2>
            <p className="mt-4 text-sm text-muted-foreground">Keine Einträge in der Kasse.</p>
          </section>
        ) : null}
      </SlideViews>

      <GroupPenaltyRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} groupId={groupId} />

      <AddGroupMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        memberIds={data?.members.map((m) => m.userId) ?? []}
        onAdd={handleAdd}
      />

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
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
