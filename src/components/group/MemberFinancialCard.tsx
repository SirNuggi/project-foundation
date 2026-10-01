import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { type MemberFinancials, type GroupFinancialOverview, recordGroupPayment, getMemberPaymentHistory } from "@/lib/groups.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

type MemberFinancialCardProps = {
  member: MemberFinancials;
  groupId: string;
  isAdmin: boolean;
  currentUserId: string;
  membershipFee: number;
};

export function MemberFinancialCard({
  member,
  groupId,
  isAdmin,
  currentUserId,
  membershipFee,
}: MemberFinancialCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"penalty" | "membership_fee">("penalty");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);

  const recordPayment = useServerFn(recordGroupPayment);
  const fetchHistory = useServerFn(getMemberPaymentHistory);
  const queryClient = useQueryClient();

  const canViewHistory = isAdmin || member.userId === currentUserId;

  async function handleRecordPayment() {
    const amount = Number(paymentAmount.trim().replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Bitte einen gültigen Betrag eingeben");
      return;
    }

    setSaving(true);
    try {
      await recordPayment({
        data: {
          groupId,
          userId: member.userId,
          amount,
          type: paymentType,
          note: paymentNote.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success("Zahlung verbucht");
      setPaymentAmount("");
      setPaymentNote("");
      setPaymentType("penalty");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Verbuchen");
    } finally {
      setSaving(false);
    }
  }

  const { data: history } = useQuery({
    queryKey: ["member-history", groupId, member.userId],
    queryFn: () => fetchHistory({ data: { groupId, userId: member.userId } }),
    enabled: historyOpen && canViewHistory,
  });

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-base font-bold">{member.name}</span>
            <Badge variant={member.role === "admin" ? "default" : "outline"}>
              {member.role === "admin" ? "Admin" : "Mitglied"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Offene Strafen</span>
            <span className="font-bold text-destructive">€ {member.openPenalties.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Mitgliedsbeitrag</span>
            <Badge variant={member.membershipFeeStatus === "paid" ? "success" : "destructive"}>
              {member.membershipFeeStatus === "paid" ? "Bezahlt" : `Offen € ${member.membershipFee.toFixed(2)}`}
            </Badge>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Gesamtsaldo</span>
              <span className={`font-bold ${member.totalOpen > 0 ? "text-destructive" : "text-success"}`}>
                € {member.totalOpen.toFixed(2)}
              </span>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setHistoryOpen(true)}
            >
              {canViewHistory ? "Kontoauszug" : "Verlauf anzeigen"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle>{member.name} — Kontoauszug & Zahlungen</DialogTitle>
          </DialogHeader>

          {!canViewHistory ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Nur Gruppen-Admins oder der Spieler selbst können den Kontoauszug einsehen.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Historische Strafen */}
              <div>
                <h3 className="text-sm font-bold mb-2">Historische Strafen</h3>
                {history?.penalties && history.penalties.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {history.penalties.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-2 border-b">
                        <span>{p.code} — {p.roundName || "Runde"}</span>
                        <span className="text-destructive">€ {p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Strafen verzeichnet.</p>
                )}
              </div>

              {/* Zahlungen */}
              <div>
                <h3 className="text-sm font-bold mb-2">Eingetragene Zahlungen</h3>
                {history?.payments && history.payments.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {history.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-2 border-b">
                        <span>
                          {p.type === "penalty" ? "Strafen" : "Mitgliedsbeitrag"}
                          {p.note && ` — ${p.note}`}
                        </span>
                        <span className="text-success">€ {p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Zahlungen verbucht.</p>
                )}
              </div>

              {/* Zahlung verbuchen */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-bold mb-3">Neue Zahlung verbuchen</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant={paymentType === "penalty" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentType("penalty")}
                    >
                      Strafen
                    </Button>
                    <Button
                      variant={paymentType === "membership_fee" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentType("membership_fee")}
                    >
                      Mitgliedsbeitrag
                    </Button>
                  </div>

                  {paymentType === "membership_fee" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentAmount(membershipFee.toFixed(2))}
                      className="w-full"
                    >
                      Vollen Betrag (€ {membershipFee.toFixed(2)}) buchen
                    </Button>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">Betrag (€)</Label>
                    <Input
                      id="payment-amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-note">Notiz (optional)</Label>
                    <Input
                      id="payment-note"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="z. B. Bar, PayPal"
                      className="h-10"
                    />
                  </div>

                  <Button
                    onClick={handleRecordPayment}
                    disabled={saving || !paymentAmount}
                    className="w-full"
                  >
                    {saving ? "Wird gespeichert…" : "Zahlung speichern"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}