import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mine, error } = await context.supabase
      .from("group_members")
      .select("role, group_id, groups(id, name, created_at)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const ids = (mine ?? []).map((m) => m.group_id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: all, error: e2 } = await context.supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", ids);
      if (e2) throw new Error(e2.message);
      for (const r of all ?? []) counts[r.group_id] = (counts[r.group_id] ?? 0) + 1;
    }
    return (mine ?? [])
      .filter((m) => m.groups)
      .map((m) => ({
        id: m.group_id,
        name: (m.groups as { name: string }).name,
        role: m.role as "admin" | "member",
        memberCount: counts[m.group_id] ?? 1,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("groups")
      .insert({ name: data.name, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("groups")
      .select("id, name")
      .eq("id", data.groupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getGroupDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .select("id, name, created_by")
      .eq("id", data.groupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) return null;
    const { data: rows, error: e2 } = await context.supabase
      .from("group_members")
      .select("id, role, user_id, profiles(display_name, handicap_index, user_type)")
      .eq("group_id", data.groupId);
    if (e2) throw new Error(e2.message);
    const members = (rows ?? []).map((r) => {
      const p = r.profiles as { display_name: string; handicap_index: number | null; user_type: string } | null;
      return {
        id: r.id,
        userId: r.user_id,
        role: r.role as "admin" | "member",
        name: p?.display_name ?? "Unbekannt",
        handicapIndex: Number(p?.handicap_index ?? 54),
        userType: (p?.user_type === "passive" ? "passive" : "active") as "active" | "passive",
      };
    });
    members.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "de") : a.role === "admin" ? -1 : 1));
    const myRole = members.find((m) => m.userId === context.userId)?.role ?? null;
    return { id: group.id, name: group.name, createdBy: group.created_by, myRole, members };
  });

export const addGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("user_type")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!p || (p.user_type !== "active" && p.user_type !== "passive")) {
      throw new Error("Nur aktive oder passive Spieler können Mitglied werden");
    }
    const { error } = await context.supabase
      .from("group_members")
      .insert({ group_id: data.groupId, user_id: data.profileId, role: "member" });
    if (error) throw new Error(error.code === "23505" ? "Spieler ist bereits Mitglied" : error.message);
    return { ok: true };
  });

export const removeGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("group_members")
      .select("user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!row) throw new Error("Mitglied nicht gefunden");
    if (row.user_id === context.userId) throw new Error("Du kannst dich nicht selbst entfernen");
    const { data: del, error } = await context.supabase
      .from("group_members")
      .delete()
      .eq("id", data.memberId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!del?.length) throw new Error("Keine Berechtigung");
    return { ok: true };
  });
