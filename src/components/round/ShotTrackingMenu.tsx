import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteLastShot, getHoleShots, logShot } from "@/lib/shots.functions";
import { getMyBag } from "@/lib/bag.functions";
import type { UserClub } from "@/lib/bag";
import type { ShotLog } from "@/lib/shots";

interface ShotTrackingMenuProps {
  roundId: string;
  holeNumber: number;
  userId: string;
  disabled: boolean;
}

export function ShotTrackingMenu({ roundId, holeNumber, userId, disabled }: ShotTrackingMenuProps) {
  const fetchShots = useServerFn(getHoleShots);
  const saveShot = useServerFn(logShot);
  const undoShot = useServerFn(deleteLastShot);
  const fetchBag = useServerFn(getMyBag);
  const { data: bag = [], isPending: bagPending, error: bagError, refetch: refetchBag } = useQuery({
    queryKey: ["golf-bag", userId],
    queryFn: () => fetchBag(),
  });
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const locked = useRef(false);
  const queryKey = ["hole-shots", roundId, userId, holeNumber];
  const { data: shots = [], isPending, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchShots({ data: { roundId, holeNumber } }),
  });

  async function capture(club: UserClub) {
    if (locked.current || disabled) return;
    locked.current = true;
    setPending(club.id);
    try {
      if (!navigator.geolocation) throw new Error("GPS wird von diesem Gerät nicht unterstützt.");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, (gpsError) => {
          const message = gpsError.code === 1
            ? "Bitte den Standortzugriff im Browser erlauben."
            : gpsError.code === 3
              ? "GPS-Abfrage dauert zu lange. Bitte erneut versuchen."
              : "GPS-Position nicht verfügbar. Bitte erneut versuchen.";
          reject(new Error(message));
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      });
      const shot = await saveShot({ data: {
        roundId, holeNumber, clubId: club.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      } });
      queryClient.setQueryData<ShotLog[]>(queryKey, (current = []) =>
        [...current.filter((item) => item.id !== shot.id), shot].sort((a, b) => a.shot_number - b.shot_number));
      toast.success(`Schlag ${shot.shot_number}: ${shot.club_name} erfasst`);
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Schlag konnte nicht gespeichert werden.");
    } finally {
      locked.current = false;
      setPending(null);
    }
  }

  async function undo() {
    if (locked.current || disabled || !shots.length) return;
    locked.current = true;
    setPending("undo");
    try {
      const deleted = await undoShot({ data: { roundId, holeNumber } });
      if (deleted) {
        queryClient.setQueryData<ShotLog[]>(queryKey, (current = []) => current.filter((shot) => shot.id !== deleted.id));
        toast.success(`Schlag ${deleted.shot_number} entfernt`);
      }
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Schlag konnte nicht entfernt werden.");
    } finally {
      locked.current = false;
      setPending(null);
    }
  }

  return (
    <div className="relative px-4 pb-3 pt-3">
      <button
        type="button"
        aria-label={historyOpen ? "Schlaghistorie einklappen" : "Schlaghistorie ausklappen"}
        onClick={() => setHistoryOpen((v) => !v)}
        className="absolute right-2 top-1 flex h-8 w-8 items-center justify-center text-muted-foreground"
      >
        {historyOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
      </button>
      {historyOpen && (
        <div className="mb-3 mr-8 border-b pb-3 animate-in fade-in slide-in-from-bottom-2 duration-200" aria-live="polite">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {isPending ? <p className="text-xs text-muted-foreground">Schläge werden geladen …</p> : error ? (
                <div className="text-xs text-destructive">Historie konnte nicht geladen werden.
                  <Button variant="link" size="sm" onClick={() => void refetch()}>Erneut laden</Button>
                </div>
              ) : !shots.length ? <p className="text-xs text-muted-foreground">Noch keine Schläge auf Loch {holeNumber}.</p> : (
                <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs">
                  {shots.map((shot, index) => {
                    const distance = shots[index + 1]?.distance_meters;
                    return (
                      <li key={shot.id}>
                        <span title={shot.club_name ?? shot.club_code} className="inline-block rounded-md bg-muted px-2 py-1 font-medium">
                          {shot.shot_number}. {shot.club_code}
                          {distance != null && ` (${Math.round(distance)} m)`}
                        </span>
                        {index < shots.length - 1 && <span className="ml-1.5 text-muted-foreground" aria-hidden="true">→</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <Button variant="outline" size="sm" aria-label="Letzten Schlag entfernen" disabled={disabled || !!pending || !shots.length || !!error || isPending} onClick={() => void undo()} className="h-8 shrink-0 gap-1 px-2 text-xs">
              {pending === "undo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Rückgängig
            </Button>
          </div>
        </div>
      )}
      <div className="mr-8">
        {bagPending ? <p className="text-xs text-muted-foreground">Golfbag wird geladen …</p> : bagError ? (
          <div className="text-xs text-destructive">Golfbag konnte nicht geladen werden.
            <Button variant="link" size="sm" onClick={() => void refetchBag()}>Erneut laden</Button>
          </div>
        ) : !bag.length ? <p className="text-xs text-muted-foreground">Dein Golfbag ist leer. Füge im Profil Schläger hinzu.</p> : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.6rem,1fr))] gap-1" aria-label="Schläger aus meinem Golfbag">
            {bag.map((club) => (
              <Button key={club.id} variant="outline" aria-label={`${club.club_name}: Schlag erfassen`} title={club.club_name} disabled={disabled || !!pending || isPending || !!error} onClick={() => void capture(club)} className="h-9 px-0 text-xs font-bold transition-transform active:scale-95">
                {pending === club.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : club.club_code}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
