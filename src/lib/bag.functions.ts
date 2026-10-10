import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { customClubSchema, sortBag, standardClubs } from "@/lib/bag";

export const getMyBag = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_clubs").select("*").eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return sortBag(data);
  });

export const addStandardClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clubCode: z.string().min(1).max(2), category: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const club = standardClubs.find((item) => item.club_code === data.clubCode && item.category === data.category);
    if (!club) throw new Error("Unbekannter Standardschläger.");
    const { data: saved, error } = await context.supabase.from("user_clubs")
      .upsert({ ...club, user_id: context.userId, is_custom: false }, { onConflict: "user_id,category,club_code", ignoreDuplicates: true }).select("*");
    if (error) throw new Error(error.message);
    return saved;
  });

export const addCustomClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => customClubSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase.from("user_clubs").insert({
      user_id: context.userId, club_code: data.clubCode, club_name: data.clubName, category: "custom", is_custom: true,
    }).select("*").single();
    if (error?.code === "23505") throw new Error("Ein eigener Schläger mit diesem Kürzel ist bereits vorhanden.");
    if (error) throw new Error(error.message);
    return saved;
  });

export const removeClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clubId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_clubs").delete().eq("id", data.clubId).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
