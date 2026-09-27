import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Admin-Zugang");
}

export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { password: string }) =>
    z.object({ password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected) throw new Error("Admin-Passwort ist nicht hinterlegt");
    if (data.password !== expected) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const [courses, rounds, players, penaltyRules] = await Promise.all([
      context.supabase.from("courses").select("id, name, city, hole_count, par_total").order("name"),
      context.supabase
        .from("rounds")
        .select("id, course_name, played_on, hole_count, status")
        .order("played_on", { ascending: false })
        .limit(50),
      context.supabase
        .from("profiles")
        .select("id, display_name, handle, handicap_index, default_tee")
        .order("display_name"),

      context.supabase.from("penalty_rules").select("code, label, amount").order("label"),
    ]);

    return {
      courses: courses.data ?? [],
      rounds: rounds.data ?? [],
      players: (players.data ?? []).map(
        (p: { id: string; display_name: string; handle: string; handicap_index: number | string | null; default_tee: string | null }) => ({
          id: p.id,
          display_name: p.display_name,
          handle: p.handle,
          handicap_index: Number(p.handicap_index ?? -54),
          default_tee: (p.default_tee ?? "herren") as "herren" | "damen",
        }),
      ),

      penaltyRules: (penaltyRules.data ?? []).map(
        (r: { code: string; label: string; amount: number | string }) => ({
          code: r.code,
          label: r.label,
          amount: Number(r.amount ?? 0),
        }),
      ),
    };
  });

export const adminUpdatePenaltyAmounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rules: z
          .array(
            z.object({
              code: z.string().min(1).max(50),
              amount: z.number().min(0).max(99.99),
            }),
          )
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (const rule of data.rules) {
      const { error } = await context.supabase
        .from("penalty_rules")
        .update({ amount: Math.round(rule.amount * 100) / 100 })
        .eq("code", rule.code);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
export const adminUpdatePlayerHandicaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        players: z
          .array(
            z.object({
              profileId: z.string().uuid(),
              handicapIndex: z.number().min(-60).max(60),
              tee: z.union([z.literal("herren"), z.literal("damen")]),
            }),
          )
          .max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const p of data.players) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          handicap_index: Math.round(p.handicapIndex * 10) / 10,
          default_tee: p.tee,
        })
        .eq("id", p.profileId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


const holeSchema = z.object({
  hole_number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  stroke_index: z.number().int().min(1).max(18).nullable().optional(),
  stroke_index_back: z.number().int().min(1).max(18).nullable().optional(),
  distance_m: z.number().int().min(0).max(800).nullable().optional(),
});

const teeBoxSchema = z.object({
  name: z.string().trim().min(1).max(30),
  slope: z.number().int().min(55).max(155),
  courseRating: z.number().min(40).max(90),
});

const courseFieldsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().max(80).optional(),
  holeCount: z.union([z.literal(9), z.literal(18)]),
  teeBoxes: z.array(teeBoxSchema).min(1).max(6),
  holes: z.array(holeSchema).max(18),
});

export const adminGetCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) =>
    z.object({ courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [{ data: course }, { data: holes }, { data: teeRows }] = await Promise.all([
      context.supabase
        .from("courses")
        .select("id, name, city, hole_count")
        .eq("id", data.courseId)
        .maybeSingle(),
      context.supabase
        .from("course_holes")
        .select("hole_number, par, stroke_index, stroke_index_back")
        .eq("course_id", data.courseId)
        .order("hole_number"),
      context.supabase
        .from("tee_boxes")
        .select("id, name, slope, course_rating")
        .eq("course_id", data.courseId)
        .order("name"),
    ]);
    if (!course) throw new Error("Platz nicht gefunden");
    return {
      id: course.id as string,
      name: course.name as string,
      city: (course.city ?? "") as string,
      holeCount: Number(course.hole_count ?? 18),
      teeBoxes: (teeRows ?? []).map(
        (t: { name: string; slope: number; course_rating: number | string }) => ({
          name: t.name,
          slope: Number(t.slope ?? 113),
          courseRating: Number(t.course_rating ?? 70),
        }),
      ),
      holes: (holes ?? []).map(
        (h: {
          hole_number: number;
          par: number;
          stroke_index: number | null;
          stroke_index_back: number | null;
        }) => ({
          hole_number: h.hole_number,
          par: h.par,
          stroke_index: h.stroke_index,
          stroke_index_back: h.stroke_index_back,
        }),
      ),
    };
  });

export const adminCreateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => courseFieldsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const parTotal = data.holes.reduce((sum, h) => sum + h.par, 0);
    const { data: course, error } = await context.supabase
      .from("courses")
      .insert({
        name: data.name,
        city: data.city || null,
        hole_count: data.holeCount,
        par_total: parTotal || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !course) throw new Error(error?.message ?? "Platz konnte nicht angelegt werden");

    const { error: teeError } = await context.supabase.from("tee_boxes").insert(
      data.teeBoxes.map((t) => ({
        course_id: course.id as string,
        name: t.name,
        slope: t.slope,
        course_rating: t.courseRating,
      })),
    );
    if (teeError) throw new Error(teeError.message);


    if (data.holes.length > 0) {
      const { error: holeError } = await context.supabase.from("course_holes").insert(
        data.holes.map((h) => ({
          course_id: course.id as string,
          hole_number: h.hole_number,
          par: h.par,
          stroke_index: h.stroke_index ?? null,
          stroke_index_back: h.stroke_index_back ?? null,
          distance_m: h.distance_m ?? null,
        })),
      );
      if (holeError) throw new Error(holeError.message);
    }
    return { id: course.id };
  });

export const adminUpdateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    courseFieldsSchema.extend({ courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const parTotal = data.holes.reduce((sum, h) => sum + h.par, 0);
    const { error } = await context.supabase
      .from("courses")
      .update({
        name: data.name,
        city: data.city || null,
        hole_count: data.holeCount,
        par_total: parTotal || null,
      })
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);

    const { error: teeDeleteError } = await context.supabase
      .from("tee_boxes")
      .delete()
      .eq("course_id", data.courseId);
    if (teeDeleteError) throw new Error(teeDeleteError.message);

    const { error: teeError } = await context.supabase.from("tee_boxes").insert(
      data.teeBoxes.map((t) => ({
        course_id: data.courseId,
        name: t.name,
        slope: t.slope,
        course_rating: t.courseRating,
      })),
    );
    if (teeError) throw new Error(teeError.message);


    const { error: deleteError } = await context.supabase
      .from("course_holes")
      .delete()
      .eq("course_id", data.courseId);
    if (deleteError) throw new Error(deleteError.message);

    if (data.holes.length > 0) {
      const { error: holeError } = await context.supabase.from("course_holes").insert(
        data.holes.map((h) => ({
          course_id: data.courseId,
          hole_number: h.hole_number,
          par: h.par,
          stroke_index: h.stroke_index ?? null,
          stroke_index_back: h.stroke_index_back ?? null,
          distance_m: h.distance_m ?? null,
        })),
      );
      if (holeError) throw new Error(holeError.message);
    }
    return { ok: true };
  });


export const adminDeleteRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roundId: string }) =>
    z.object({ roundId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("rounds").delete().eq("id", data.roundId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) =>
    z.object({ courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("courses").delete().eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) =>
    z.object({ playerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.playerId === context.userId) throw new Error("Eigenes Konto kann nicht geloescht werden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.playerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
