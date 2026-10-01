import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Lock,
  PlusCircle,
  Receipt,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type MemberFinancials,
  getMemberPaymentHistory,
  recordGroupPayment,
} from "@/lib/groups.functions";

type MemberFinancialCardProps = {
  member: MemberFinancials;
  groupId: string;
  isAdmin: boolean;
  currentUserId: string;
  membershipFee: number;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}

export function MemberFinancialCard({
  member,
  groupId,
  isAdmin,
  currentUserId,
  membershipFee,
}: MemberFinancialCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"penalty" | "membership_fee">("penalty");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();
  const recordPayment = useServerFn(recordGroupPayment);
  const fetchHistory = useServerFn(getMemberPaymentHistory);

  const canViewHistory = isAdmin || (!!currentUserId && member.userId === currentUserId);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["member-history", groupId, member.userId],
    queryFn: () => fetchHistory({ data: { groupId, userId: member.userId } }),
    enabled: dialogOpen && canViewHistory,
  });

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    const cleanStr = paymentAmount.trim().replace(",", ".");
    const parsed = Number(cleanStr);

    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Bitte einen gültigen Betrag größer als 0 eingeben.");
      return;
    }

    setSaving(true);
    try {
      await recordPayment({
        data: {
          groupId,
          userId: member.userId,
          amount: parsed,
          type: paymentType,
          note: paymentNote.trim() || undefined,
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["group-financial", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["member-history", groupId, member.userId] }),
        queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
      ]);

      toast.success("Zahlung erfolgreich verbucht");
      setPaymentAmount("");
      setPaymentNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern der Zahlung");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectFullMembershipFee() {
    setPaymentType("membership_fee");
    const openAmount = Math.max(0, membershipFee - member.paidMembershipFee);
    setPaymentAmount((openAmount > 0 ? openAmount : membershipFee).toFixed(2).replace(".", ","));
  }

  function handleSelectFullPenalties() {
    setPaymentType("penalty");
    setPaymentAmount(member.openPenalties > 0 ? member.openPenalties.toFixed(2).replace(".", ",") : "0,00");
  }

  return (
    <>
      <Card
        className={`group transition-all rounded-2xl border bg-card ${
          canViewHistory ? "cursor-pointer hover:border-primary/50 hover:shadow-sm" : ""
        }`}
        onClick={() => {
          if (canViewHistory) setDialogOpen(true);
        }}
      >
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-11 w-11 shrink-0 border">
                <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-black tracking-tight">
                  {member.name}
                  {currentUserId === member.userId && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Du)</span>
                  )}
                </CardTitle>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant={member.role === "admin" ? "default" : "outline"} className="text-[11px] font-bold">
                    {member.role === "admin" ? "Admin" : "Mitglied"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Saldo Badge */}
            <div className="text-right">
              <span className="text-[11px] font-medium text-muted-foreground block">Offener Saldo</span>
              <span
                className={`text-lg font-black tracking-tight ${
                  member.totalOpen > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatCurrency(member.totalOpen)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-4 px-4 sm:px-6 pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
            <div>
              <span className="text-muted-foreground block">Offene Strafen</span>
              <span className="font-bold text-foreground">
                {formatCurrency(member.openPenalties)}
                {member.paidPenalties > 0 && (
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    (bezahlt {formatCurrency(member.paidPenalties)})
                  </span>
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Mitgliedsbeitrag</span>
              {membershipFee <= 0 ? (
                <span className="text-muted-foreground font-medium">Kein Beitrag</span>
              ) : member.membershipFeeStatus === "paid" ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] py-0 px-1.5 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Bezahlt
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-semibold text-[10px] py-0 px-1.5 mt-0.5">
                  <Clock className="h-3 w-3 mr-1" />
                  Offen ({formatCurrency(membershipFee)})
                </Badge>
              )}
            </div>
          </div>

          <div className="pt-1">
            {canViewHistory ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold h-9 gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogOpen(true);
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                Kontoauszug & Zahlungen
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                className="w-full text-xs text-muted-foreground h-9 gap-1.5 cursor-not-allowed opacity-60"
              >
                <Lock className="h-3.5 w-3.5" />
                Nur für Admins & Spieler einsehbar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail-Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg w-[calc(100%-2rem)] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/40">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-lg font-black">{member.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  Kontoauszug, Strafenübersicht & Zahlungsverlauf
                </DialogDescription>
              </div>
            </div>

            {/* Übersichtssaldo im Modal Header */}
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-background p-2.5 text-center text-xs border">
              <div>
                <p className="text-muted-foreground text-[10px]">Strafen gesamt</p>
                <p className="font-bold text-foreground">{formatCurrency(member.totalPenalties)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Gezahlt</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(member.paidPenalties + member.paidMembershipFee)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Offener Saldo</p>
                <p className={`font-black ${member.totalOpen > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {formatCurrency(member.totalOpen)}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-14rem)] px-5 py-4">
            <div className="space-y-6">
              {/* 1. Zahlung verbuchen (Nur für Gruppen-Admins) */}
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5 mb-3">
                    <PlusCircle className="h-4 w-4 text-primary" />
                    Zahlung verbuchen
                  </h3>

                  <form onSubmit={handleRecordPayment} className="space-y-3 bg-card p-3.5 rounded-xl border">
                    {/* Typ-Auswahl */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Zahlungsart</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={paymentType === "penalty" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-semibold"
                          onClick={() => setPaymentType("penalty")}
                        >
                          Strafen
                        </Button>
                        <Button
                          type="button"
                          variant={paymentType === "membership_fee" ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-semibold"
                          onClick={() => setPaymentType("membership_fee")}
                        >
                          Mitgliedsbeitrag
                        </Button>
                      </div>
                    </div>

                    {/* Schnellauswahl-Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {paymentType === "membership_fee" && membershipFee > 0 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-[11px] px-2"
                          onClick={handleSelectFullMembershipFee}
                        >
                          Beitrag ({formatCurrency(membershipFee)})
                        </Button>
                      )}
                      {paymentType === "penalty" && member.openPenalties > 0 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-[11px] px-2"
                          onClick={handleSelectFullPenalties}
                        >
                          Offene Strafen ({formatCurrency(member.openPenalties)})
                        </Button>
                      )}
                    </div>

                    {/* Betrag */}
                    <div className="space-y-1.5">
                      <Label htmlFor={`pay-amount-${member.userId}`} className="text-xs">
                        Betrag (€)
                      </Label>
                      <div className="relative">
                        <Input
                          id={`pay-amount-${member.userId}`}
                          inputMode="decimal"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0,00"
                          className="h-9 pr-8 text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                          €
                        </span>
                      </div>
                    </div>

                    {/* Notiz */}
                    <div className="space-y-1.5">
                      <Label htmlFor={`pay-note-${member.userId}`} className="text-xs">
                        Notiz (optional)
                      </Label>
                      <Input
                        id={`pay-note-${member.userId}`}
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="z. B. Bar, PayPal, Überweisung"
                        maxLength={200}
                        className="h-9 text-xs"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={saving || !paymentAmount.trim()}
                      className="w-full h-10 font-bold text-xs mt-2"
                    >
                      {saving ? "Wird gespeichert…" : "Zahlung speichern"}
                    </Button>
                  </form>
                </div>
              )}

              {/* 2. Historische Strafen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    Runden-Strafen
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Offen: {formatCurrency(member.openPenalties)}
                  </span>
                </div>

                {historyLoading ? (
                  <p className="text-xs text-muted-foreground py-2">Lade Historie…</p>
                ) : history?.penalties && history.penalties.length > 0 ? (
                  <div className="space-y-1.5">
                    {history.penalties.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-muted/40 border border-border/50"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold truncate">{p.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {p.roundName || "Runde"} • {formatDate(p.roundDate || p.date)}
                          </p>
                        </div>
                        <span className="font-bold text-destructive shrink-0">
                          - {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Keine Runden-Strafen für dieses Mitglied erfasst.
                  </div>
                )}
              </div>

              {/* 3. Eingetragene Zahlungen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Bisherige Zahlungen
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Summe: {formatCurrency(member.paidPenalties + member.paidMembershipFee)}
                  </span>
                </div>

                {historyLoading ? (
                  <p className="text-xs text-muted-foreground py-2">Lade Zahlungen…</p>
                ) : history?.payments && history.payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {history.payments.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                            >
                              {p.type === "penalty" ? "Strafen" : "Mitgliedsbeitrag"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{formatDate(p.date)}</span>
                          </div>
                          {p.note && (
                            <p className="text-[11px] text-foreground mt-0.5 truncate font-medium">
                              {p.note}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          + {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Bisher wurden keine Zahlungen für dieses Mitglied erfasst.
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
