import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings } from "lucide-react";
import { getMyBag } from "@/lib/bag.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageGolfBagModal } from "@/components/profile/ManageGolfBagModal";

export function GolfBagSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const fetchBag = useServerFn(getMyBag);
  const { data: clubs = [], isPending, error, refetch } = useQuery({
    queryKey: ["golf-bag", userId],
    queryFn: () => fetchBag(),
  });
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-lg font-bold">Mein Golfbag</CardTitle>
          <Button type="button" variant="ghost" aria-label="Golfbag-Einstellungen" disabled={isPending || !!error} onClick={() => setOpen(true)} className="relative flex h-11 w-11 min-w-0 flex-col items-center justify-center gap-0.5 p-0 text-muted-foreground transition-colors hover:text-primary">
            <Settings className="h-4.5 w-4.5" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          {isPending ? <p className="text-sm text-muted-foreground">Golfbag wird geladen …</p> : error ? (
            <div className="text-sm text-destructive">Golfbag konnte nicht geladen werden.<Button type="button" variant="link" onClick={() => void refetch()}>Erneut versuchen</Button></div>
          ) : !clubs.length ? <p className="text-sm text-muted-foreground">Dein Bag ist leer. Füge über das Zahnrad Schläger hinzu.</p> : (
            <div className="flex flex-wrap gap-2">
              {clubs.map((club) => (
                <div key={club.id} title={club.club_name} aria-label={club.club_name} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-card text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-accent/50 animate-in fade-in zoom-in-95 duration-200">{club.club_code}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ManageGolfBagModal open={open} onOpenChange={setOpen} clubs={clubs} userId={userId} />
    </>
  );
}
