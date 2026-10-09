import type { Tables } from "@/integrations/supabase/types";

export const clubs = [
  { code: "driver", short: "D", label: "Driver" },
  { code: "wood3", short: "H3", label: "Holz 3" },
  { code: "hybrid", short: "H", label: "Hybrid" },
  { code: "i5", short: "i5", label: "Eisen 5" },
  { code: "i7", short: "i7", label: "Eisen 7" },
  { code: "i9", short: "i9", label: "Eisen 9" },
  { code: "pw", short: "PW", label: "Pitching Wedge" },
  { code: "sw", short: "SW", label: "Sand Wedge" },
  { code: "putter", short: "P", label: "Putter" },
] as const;

export type ClubCode = (typeof clubs)[number]["code"];
export type ShotLog = Tables<"shot_logs">;
