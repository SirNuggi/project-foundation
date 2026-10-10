import type { Tables } from "@/integrations/supabase/types";
import { z } from "zod";

export const customClubSchema = z.object({
  clubName: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(80),
  clubCode: z.string().trim().min(1, "Bitte ein Kürzel eingeben.").max(2).regex(/^[\p{L}\p{N}]{1,2}$/u, "Nur Buchstaben und Zahlen verwenden.").transform((value) => value.toUpperCase()).pipe(z.string().max(2, "Das Kürzel darf höchstens 2 Zeichen haben.")),
});
export type UserClub = Tables<"user_clubs">;
export const bagCategories = [
  { code: "woods", label: "Hölzer" },
  { code: "hybrids", label: "Hybrids / Rescues" },
  { code: "irons", label: "Eisen" },
  { code: "wedges", label: "Wedges" },
  { code: "putter", label: "Putter" },
  { code: "custom", label: "Eigene Schläger" },
] as const;
export const standardClubs = [
  { club_code: "D", club_name: "Driver", category: "woods" },
  ...[3, 5, 7].map((n) => ({ club_code: `W${n}`, club_name: `Holz ${n}`, category: "woods" })),
  ...[2, 3, 4, 5].map((n) => ({ club_code: `H${n}`, club_name: `Hybrid ${n}`, category: "hybrids" })),
  ...[3, 4, 5, 6, 7, 8, 9].map((n) => ({ club_code: `I${n}`, club_name: `Eisen ${n}`, category: "irons" })),
  { club_code: "PW", club_name: "Pitching Wedge", category: "wedges" },
  { club_code: "GW", club_name: "Gap Wedge", category: "wedges" },
  { club_code: "SW", club_name: "Sand Wedge", category: "wedges" },
  { club_code: "LW", club_name: "Lob Wedge", category: "wedges" },
  { club_code: "P", club_name: "Putter", category: "putter" },
];

export function sortBag(clubs: UserClub[]) {
  return [...clubs].sort((a, b) => {
    const categoryOrder = bagCategories.findIndex((c) => c.code === a.category)
      - bagCategories.findIndex((c) => c.code === b.category);
    if (categoryOrder) return categoryOrder;
    const index = (club: UserClub) => standardClubs.findIndex((c) => c.category === club.category && c.club_code === club.club_code);
    return index(a) - index(b) || a.club_name.localeCompare(b.club_name);
  });
}
