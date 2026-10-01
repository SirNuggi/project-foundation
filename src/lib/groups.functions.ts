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

export const renameGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ groupId: z.string().uuid(), name: z.string().trim().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: membership, error: membershipError } = await context.supabase
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership) throw new Error("Nur Gruppen-Admins können die Gruppe umbenennen");

    const { data: row, error } = await context.supabase
      .from("groups")
      .update({ name: data.name })
      .eq("id", data.groupId)
      .select("id, name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Gruppe nicht gefunden oder keine Berechtigung");
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
      .select("id, name, created_by, has_penalty_fund, membership_fee")
      .eq("id", data.groupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) return null;
    const { data: rows, error: e2 } = await context.supabase
      .from("group_members")
      .select("id, role, user_id, profiles(display_name, handle, handicap_index, user_type, avatar_url)")
      .eq("group_id", data.groupId);
    if (e2) throw new Error(e2.message);
    const members = (rows ?? []).map((r) => {
      const p = r.profiles as { display_name: string | null; handle: string | null; handicap_index: number | null; user_type: string | null; avatar_url: string | null } | null;
      return {
        id: r.id,
        userId: r.user_id,
        role: r.role as "admin" | "member",
        name: p?.display_name || p?.handle || "Unbekannt",
        avatarUrl: p?.avatar_url ?? null,
        handicapIndex: Number(p?.handicap_index ?? 54),
        userType: (p?.user_type === "passive" ? "passive" : "active") as "active" | "passive",
      };
    });
    members.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "de") : a.role === "admin" ? -1 : 1));
    const myRole = members.find((m) => m.userId === context.userId)?.role ?? null;
    return {
      id: group.id,
      name: group.name,
      createdBy: group.created_by,
      hasPenaltyFund: !!group.has_penalty_fund,
      membershipFee: Number(group.membership_fee ?? 0),
      myRole,
      myUserId: context.userId,
      members,
    };
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

export const updateGroupFund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        groupId: z.string().uuid(),
        hasPenaltyFund: z.boolean().optional(),
        membershipFee: z.number().min(0).max(9999.99).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { has_penalty_fund?: boolean; membership_fee?: number } = {};
    if (data.hasPenaltyFund !== undefined) patch.has_penalty_fund = data.hasPenaltyFund;
    if (data.membershipFee !== undefined) patch.membership_fee = Math.round(data.membershipFee * 100) / 100;
    const { data: row, error } = await context.supabase
      .from("groups")
      .update(patch)
      .eq("id", data.groupId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Nur Gruppen-Admins können das ändern");
    return { ok: true };
  });

export const recordGroupPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        groupId: z.string().uuid(),
        userId: z.string().uuid(),
        amount: z.number().min(0.01).max(9999.99),
        type: z.enum(["penalty", "membership_fee"]),
        note: z.string().trim().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Prüfe Admin-Rechte
    const { data: isAdmin } = await sb.rpc("is_group_admin", {
      _group_id: data.groupId,
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Nur Gruppen-Admins können Zahlungen verbuchen");

    const { error } = await (sb as any).from("group_payments").insert({
      group_id: data.groupId,
      user_id: data.userId,
      amount: Math.round(data.amount * 100) / 100,
      type: data.type,
      note: data.note ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DEFAULT_GROUP_RULES = [
  { code: "double_par", label: "Doppel-Par", amount: 0.5, is_automatic: true },
  { code: "three_putt", label: "3-Putt", amount: 0.5, is_automatic: true },
];

export const getGroupPenaltyRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("group_penalty_rules")
      .select("id, code, label, amount, is_automatic")
      .eq("group_id", data.groupId)
      .order("created_at");
    if (error) throw new Error(error.message);
    const list = (rows ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
    for (const d of DEFAULT_GROUP_RULES) {
      if (!list.some((r) => r.code === d.code)) list.unshift({ id: "", ...d });
    }
    return list;
  });

export const saveGroupPenaltyRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        groupId: z.string().uuid(),
        rules: z
          .array(
            z.object({
              code: z.string().trim().min(1).max(60),
              label: z.string().trim().min(1).max(50),
              amount: z.number().min(0).max(9999.99),
              is_automatic: z.boolean(),
            }),
          )
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_group_admin", {
      _group_id: data.groupId,
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Nur Gruppen-Admins können Strafen festlegen");
    const codes = data.rules.map((r) => r.code);
    if (new Set(codes).size !== codes.length) throw new Error("Strafnamen müssen eindeutig sein");
    const { data: existing, error: e1 } = await context.supabase
      .from("group_penalty_rules")
      .select("code")
      .eq("group_id", data.groupId);
    if (e1) throw new Error(e1.message);
    const toDelete = (existing ?? []).map((r) => r.code).filter((c) => !codes.includes(c));
    if (toDelete.length) {
      const { error } = await context.supabase
        .from("group_penalty_rules")
        .delete()
        .eq("group_id", data.groupId)
        .in("code", toDelete);
      if (error) throw new Error(error.message);
    }
    if (data.rules.length) {
      const { error } = await context.supabase.from("group_penalty_rules").upsert(
        data.rules.map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100, group_id: data.groupId })),
        { onConflict: "group_id,code" },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// --- Kassen- & Zahlungsverwaltung ---

export type MemberFinancials = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  totalPenalties: number;        // Summe aller Strafen aus Runden
  paidPenalties: number;         // Gezahlte Strafen aus group_payments
  openPenalties: number;         // totalPenalties - paidPenalties
  membershipFee: number;         // Gruppen-Mitgliedsbeitrag
  paidMembershipFee: number;     // Gezahlter Mitgliedsbeitrag
  membershipFeeStatus: "paid" | "open"; // "paid" wenn paidMembershipFee >= membershipFee
  totalOpen: number;             // openPenalties + (membershipFeeStatus === "open" ? membershipFee : 0)
};

export type GroupFinancialOverview = {
  members: MemberFinancials[];
  totalOpenAmount: number;
  totalOpenPenalties: number;
  openMembershipCount: number;
};

export const getGroupFinancialOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<GroupFinancialOverview> => {
    const sb = context.supabase;

    // 1. Gruppen-Info laden (Mitgliedsbeitrag)
    const { data: group, error: groupError } = await sb
      .from("groups")
      .select("id, name, membership_fee")
      .eq("id", data.groupId)
      .maybeSingle();
    if (groupError) throw new Error(groupError.message);
    if (!group) throw new Error("Gruppe nicht gefunden");

    const membershipFee = Number(group.membership_fee ?? 0);

    // 2. Alle Mitglieder der Gruppe laden
    const { data: members, error: membersError } = await sb
      .from("group_members")
      .select("id, role, user_id, profiles(display_name, handle, avatar_url)")
      .eq("group_id", data.groupId);
    if (membersError) throw new Error(membersError.message);

    // 3. Alle Runden dieser Gruppe finden
    const { data: groupRounds, error: roundsError } = await sb
      .from("rounds")
      .select("id")
      .eq("group_id", data.groupId);
    if (roundsError) throw new Error(roundsError.message);

    const roundIds = (groupRounds ?? []).map((r) => r.id);

    // 4. Alle Strafen aus Runden dieser Gruppe laden
    const penaltiesByUser = new Map<string, number>();
    if (roundIds.length > 0) {
      try {
        const { data: penalties, error: penaltiesError } = await sb
          .from("penalties")
          .select("amount, round_players(profile_id)")
          .in("round_id", roundIds);
        if (!penaltiesError && penalties) {
          for (const p of penalties) {
            const profileId = (p.round_players as any)?.profile_id;
            if (profileId) {
              penaltiesByUser.set(profileId, (penaltiesByUser.get(profileId) ?? 0) + Number(p.amount ?? 0));
            }
          }
        }
      } catch (err) {
        console.warn("Fehler beim Abrufen der Strafen:", err);
      }
    }

    // 5. Alle Zahlungen aus group_payments laden (falls Tabelle existiert)
    const paidPenaltiesByUser = new Map<string, number>();
    const paidMembershipByUser = new Map<string, number>();
    try {
      const { data: payments, error: paymentsError } = await (sb as any)
        .from("group_payments")
        .select("user_id, amount, type")
        .eq("group_id", data.groupId);

      if (!paymentsError && payments) {
        for (const p of payments) {
          const amt = Number(p.amount ?? 0);
          if (p.type === "penalty") {
            paidPenaltiesByUser.set(p.user_id, (paidPenaltiesByUser.get(p.user_id) ?? 0) + amt);
          } else if (p.type === "membership_fee") {
            paidMembershipByUser.set(p.user_id, (paidMembershipByUser.get(p.user_id) ?? 0) + amt);
          }
        }
      }
    } catch (err) {
      console.warn("Fehler beim Abrufen der group_payments:", err);
    }

    const memberFinancials: MemberFinancials[] = (members ?? []).map((m) => {
      const userId = m.user_id;
      const totalPenalties = penaltiesByUser.get(userId) ?? 0;
      const paidPenalties = paidPenaltiesByUser.get(userId) ?? 0;
      const openPenalties = Math.max(0, totalPenalties - paidPenalties);
      const paidMembershipFee = paidMembershipByUser.get(userId) ?? 0;
      const membershipFeeStatus = membershipFee > 0 && paidMembershipFee >= membershipFee ? "paid" : (membershipFee > 0 ? "open" : "paid");
      const openMembershipFee = membershipFeeStatus === "open" ? Math.max(0, membershipFee - paidMembershipFee) : 0;
      const totalOpen = openPenalties + openMembershipFee;

      const p = m.profiles as any;
      const name = p?.display_name || p?.handle || "Unbekannt";

      return {
        userId,
        name,
        avatarUrl: p?.avatar_url ?? null,
        role: m.role as "admin" | "member",
        totalPenalties,
        paidPenalties,
        openPenalties,
        membershipFee,
        paidMembershipFee,
        membershipFeeStatus,
        totalOpen,
      };
    });

    // Sortierung: Admins zuerst, dann nach offenem Saldo absteigend, dann alphabetisch
    memberFinancials.sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      if (b.totalOpen !== a.totalOpen) return b.totalOpen - a.totalOpen;
      return a.name.localeCompare(b.name, "de");
    });

    const totalOpenAmount = memberFinancials.reduce((sum, m) => sum + m.totalOpen, 0);
    const totalOpenPenalties = memberFinancials.reduce((sum, m) => sum + m.openPenalties, 0);
    const openMembershipCount = memberFinancials.filter((m) => m.membershipFee > 0 && m.membershipFeeStatus === "open").length;

    return {
      members: memberFinancials,
      totalOpenAmount,
      totalOpenPenalties,
      openMembershipCount,
    };
  });

export type MemberPaymentHistory = {
  penalties: {
    amount: number;
    code: string;
    label: string;
    date: string;
    roundName: string | null;
    roundDate: string | null;
  }[];
  payments: {
    amount: number;
    type: "penalty" | "membership_fee";
    note: string | null;
    date: string;
  }[];
};

export const getMemberPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MemberPaymentHistory> => {
    const sb = context.supabase;

    // Prüfen ob der Nutzer Admin ist oder es sich um die eigene Karte handelt
    const { data: isAdmin } = await sb.rpc("is_group_admin", {
      _group_id: data.groupId,
      _user_id: context.userId,
    });
    const isOwn = data.userId === context.userId;
    if (!isAdmin && !isOwn) throw new Error("Keine Berechtigung für diese Ansicht");

    // 1. Runden der Gruppe laden
    const { data: groupRounds } = await sb
      .from("rounds")
      .select("id, name, played_on")
      .eq("group_id", data.groupId);

    const roundMap = new Map((groupRounds ?? []).map((r) => [r.id, r]));
    const roundIds = Array.from(roundMap.keys());

    // 2. Regeln laden für lesbare Labels
    const [globalRulesRes, groupRulesRes] = await Promise.all([
      sb.from("penalty_rules").select("code, label"),
      sb.from("group_penalty_rules").select("code, label").eq("group_id", data.groupId),
    ]);
    const labelMap = new Map<string, string>();
    for (const r of globalRulesRes.data ?? []) labelMap.set(r.code, r.label);
    for (const r of groupRulesRes.data ?? []) labelMap.set(r.code, r.label);

    let penaltiesList: MemberPaymentHistory["penalties"] = [];

    if (roundIds.length > 0) {
      try {
        const { data: penalties, error: penaltiesError } = await sb
          .from("penalties")
          .select("amount, code, created_at, round_id, round_players!inner(profile_id)")
          .in("round_id", roundIds)
          .eq("round_players.profile_id", data.userId)
          .order("created_at", { ascending: false });

        if (!penaltiesError && penalties) {
          penaltiesList = penalties.map((p) => {
            const round = roundMap.get(p.round_id);
            const label = labelMap.get(p.code) ?? (p.code === "girly" ? "Girly" : p.code);
            return {
              amount: Number(p.amount ?? 0),
              code: p.code,
              label,
              date: p.created_at,
              roundName: round?.name ?? null,
              roundDate: round?.played_on ?? null,
            };
          });
        }
      } catch (err) {
        console.warn("Fehler beim Laden der Spieler-Strafen:", err);
      }
    }

    // 3. Zahlungen aus group_payments
    let paymentsList: MemberPaymentHistory["payments"] = [];
    try {
      const { data: payments, error: paymentsError } = await (sb as any)
        .from("group_payments")
        .select("amount, type, note, created_at")
        .eq("group_id", data.groupId)
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false });

      if (!paymentsError && payments) {
        paymentsList = payments.map((p: any) => ({
          amount: Number(p.amount ?? 0),
          type: p.type,
          note: p.note,
          date: p.created_at,
        }));
      }
    } catch (err) {
      console.warn("Fehler beim Laden der Spieler-Zahlungen:", err);
    }

    return {
      penalties: penaltiesList,
      payments: paymentsList,
    };
  });
