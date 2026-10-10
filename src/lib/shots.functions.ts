import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const holeSchema = z.object({
  roundId: z.string().uuid(),
  holeNumber: z.number().int().min(1).max(18),
});
const shotSchema = holeSchema.extend({
  clubId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export const getHoleShots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => holeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: shots, error } = await context.supabase
      .from("shot_logs")
      .select("*")
      .eq("round_id", data.roundId)
      .eq("user_id", context.userId)
      .eq("hole_number", data.holeNumber)
      .order("shot_number", { ascending: true });
    if (error) throw new Error(error.message);
    return shots;
  });

export const logShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => shotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: club, error: clubError } = await sb.from("user_clubs")
      .select("club_code, club_name").eq("id", data.clubId).eq("user_id", context.userId).maybeSingle();
    if (clubError) throw new Error(clubError.message);
    if (!club) throw new Error("Dieser Schläger ist nicht mehr in deinem Golfbag.");
    const { data: round, error: roundError } = await sb.from("rounds")
      .select("hole_count").eq("id", data.roundId).maybeSingle();
    if (roundError) throw new Error(roundError.message);
    if (!round || data.holeNumber > round.hole_count) throw new Error("Dieses Loch gehört nicht zur Runde.");

    // Ein Unique-Constraint verhindert doppelte Nummern bei parallelen Geräten.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: previous, error: readError } = await sb.from("shot_logs")
        .select("shot_number, latitude, longitude")
        .eq("round_id", data.roundId).eq("user_id", context.userId)
        .eq("hole_number", data.holeNumber)
        .order("shot_number", { ascending: false }).limit(1).maybeSingle();
      if (readError) throw new Error(readError.message);

      let distance: number | null = null;
      if (previous) {
        const radians = Math.PI / 180;
        const dLat = (data.latitude - previous.latitude) * radians;
        const dLon = (data.longitude - previous.longitude) * radians;
        const a = Math.sin(dLat / 2) ** 2
          + Math.cos(previous.latitude * radians) * Math.cos(data.latitude * radians)
          * Math.sin(dLon / 2) ** 2;
        distance = Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) * 10) / 10;
        if (distance > 99999.9) throw new Error("GPS-Position liegt zu weit vom vorherigen Schlag entfernt.");
      }
      const { data: shot, error } = await sb.from("shot_logs").insert({
        round_id: data.roundId,
        user_id: context.userId,
        hole_number: data.holeNumber,
        shot_number: (previous?.shot_number ?? 0) + 1,
        club_code: club.club_code,
        club_name: club.club_name,
        latitude: data.latitude,
        longitude: data.longitude,
        distance_meters: distance,
      }).select("*").single();
      if (!error) return shot;
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Gleichzeitige Schlagerfassung. Bitte erneut versuchen.");
  });

export const deleteLastShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => holeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: last, error: readError } = await sb.from("shot_logs").select("id")
      .eq("round_id", data.roundId).eq("user_id", context.userId)
      .eq("hole_number", data.holeNumber)
      .order("shot_number", { ascending: false }).limit(1).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!last) return null;
    const { data: deleted, error } = await sb.from("shot_logs").delete()
      .eq("id", last.id).eq("user_id", context.userId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return deleted;
  });
