import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { addCustomClub, addStandardClub, removeClub } from "@/lib/bag.functions";
import { bagCategories, customClubSchema, sortBag, standardClubs, type UserClub } from "@/lib/bag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ManageGolfBagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubs: UserClub[];
  userId: string;
}

export function ManageGolfBagModal({ open, onOpenChange, clubs, userId }: ManageGolfBagModalProps) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const addStandard = useServerFn(addStandardClub);
  const addCustom = useServerFn(addCustomClub);
  const remove = useServerFn(removeClub);
  const queryClient = useQueryClient();
  const queryKey = ["golf-bag", userId];
  const form = useForm<z.input<typeof customClubSchema>>({ resolver: zodResolver(customClubSchema), defaultValues: { clubName: "", clubCode: "" } });

  async function toggle(club: (typeof standardClubs)[number], selected?: UserClub) {
    if (busy) return;
    setBusy(true);
    const previous = queryClient.getQueryData<UserClub[]>(queryKey);
    if (selected) queryClient.setQueryData<UserClub[]>(queryKey, (current = []) => current.filter((item) => item.id !== selected.id));
    try {
      if (selected) await remove({ data: { clubId: selected.id } });
      else {
        const saved = await addStandard({ data: { clubCode: club.club_code, category: club.category } });
        queryClient.setQueryData<UserClub[]>(queryKey, (current = []) => sortBag([...current, ...saved.filter((item) => !current.some((existing) => existing.id === item.id))]));
      }
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      if (previous) queryClient.setQueryData(queryKey, previous);
      toast.error(cause instanceof Error ? cause.message : "Golfbag konnte nicht geändert werden.");
    } finally { setBusy(false); }
  }

  async function create(values: z.input<typeof customClubSchema>) {
    setBusy(true);
    try {
      const saved = await addCustom({ data: values });
      queryClient.setQueryData<UserClub[]>(queryKey, (current = []) => sortBag([...current, saved]));
      form.reset();
      toast.success(`${saved.club_name} hinzugefügt`);
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Schläger konnte nicht angelegt werden.");
    } finally { setBusy(false); }
  }

  const query = search.trim().toLocaleLowerCase();
  const available = [...standardClubs.map((club) => ({ ...club, selected: clubs.find((item) => !item.is_custom && item.category === club.category && item.club_code === club.club_code) })),
    ...clubs.filter((club) => club.is_custom).map((club) => ({ ...club, selected: club }))]
    .filter((club) => `${club.club_name} ${club.club_code}`.toLocaleLowerCase().includes(query));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mein Golfbag verwalten</DialogTitle>
          <DialogDescription>Wähle deine Schläger aus. Änderungen werden sofort gespeichert.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Schläger suchen" placeholder="Name oder Kürzel suchen …" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Form {...form}>
          <form onSubmit={(event) => { event.stopPropagation(); void form.handleSubmit(create)(event); }} className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <h3 className="text-sm font-bold">Eigenen Schläger anlegen</h3>
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <FormField control={form.control} name="clubName" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Lob Wedge 60°" maxLength={80} disabled={busy} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="clubCode" render={({ field }) => (
                <FormItem><FormLabel>Kürzel</FormLabel><FormControl><Input {...field} placeholder="60" maxLength={2} disabled={busy} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <Button type="submit" size="sm" disabled={busy} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hinzufügen</Button>
          </form>
        </Form>
        <div className="space-y-4" aria-busy={busy}>
          {bagCategories.map((category) => {
            const items = available.filter((club) => club.category === category.code);
            if (!items.length) return null;
            return (
              <section key={category.code}>
                <h3 className="mb-2 text-sm font-bold text-muted-foreground">{category.label}</h3>
                <div className="space-y-1">
                  {items.map((club) => (
                    <label key={`${club.category}-${club.club_code}`} className="flex cursor-pointer items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-accent/50">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-card text-sm font-bold text-foreground shadow-sm">{club.club_code}</span>
                      <span className="min-w-0 flex-1 break-words text-sm">{club.club_name}</span>
                      <Checkbox checked={!!club.selected} disabled={busy} onCheckedChange={() => void toggle(club, club.selected)} aria-label={`${club.club_name} ${club.selected ? "entfernen" : "auswählen"}`} className="mr-2" />
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
          {!available.length && <p className="py-4 text-center text-sm text-muted-foreground">Keine passenden Schläger.</p>}
        </div>
        <p className="text-xs text-muted-foreground">Eigene Schläger werden beim Abwählen gelöscht und können erneut angelegt werden.</p>
      </DialogContent>
    </Dialog>
  );
}
