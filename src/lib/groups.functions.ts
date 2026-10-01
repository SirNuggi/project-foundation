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
    return { id: group.id, name: group.name, createdBy: group.created_by, hasPenaltyFund: !!group.has_penalty_fund, membershipFee: Number(group.membership_fee ?? 0), myRole, members };
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

export const getGroupFinancialOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Prüfe, ob der Nutzer Mitglied der Gruppe ist
    const { data: membership } = await sb
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) throw new Error("Kein Zugriff auf diese Gruppe");

    // Hole Gruppen-Mitglieder
    const { data: members, error: membersError } = await sb
      .from("group_members")
      .select("id, user_id, role, profiles(display_name, handicap_index, user_type)")
      .eq("group_id", data.groupId);
    if (membersError) throw new Error(membersError.message);

    // Hole Gruppen-Details (membership_fee)
    const { data: group, error: groupError } = await sb
      .from("groups")
      .select("id, membership_fee")
      .eq("id", data.groupId)
      .maybeSingle();
    if (groupError) throw new Error(groupError.message);
    const membershipFee = Number(group?.membership_fee ?? 0);

    // Hole alle Runden der Gruppe
    const { data: rounds, error: roundsError } = await sb
      .from("rounds")
      .select("id")
      .eq("group_id", data.groupId);
    if (roundsError) throw new Error(roundsError.message);
    const roundIds = (rounds ?? []).map((r) => r.id);

    // Hole alle Strafen für diese Runden
    const { data: penalties, error: penaltiesError } = await sb
      .from("penalties")
      .select("id, round_player_id, round_id, amount")
      .in("round_id", roundIds);
    if (penaltiesError) throw new Error(penaltiesError.message);

    // Hole round_players, um round_player_id → profile_id zu mappen
    const { data: roundPlayers, error: rpError } = await sb
      .from("round_players")
      .select("id, profile_id")
      .in("round_id", roundIds);
    if (rpError) throw new Error(rpError.message);

    // Map: round_player_id → profile_id
    const rpProfileMap = new Map<string, string | null>();
    for (const rp of roundPlayers ?? []) {
      rpProfileMap.set(rp.id, rp.profile_id);
    }

    // Berechne Straf-Summen pro profile_id
    const penaltySums = new Map<string, number>();
    for (const p of penalties ?? []) {
      const profileId = rpProfileMap.get(p.round_player_id);
      if (!profileId) continue;
      const current = penaltySums.get(profileId) ?? 0;
      penaltySums.set(profileId, current + Number(p.amount));
    }

    // Hole group_payments für diese Gruppe
    const { data: payments, error: paymentsError } = await sb
      .from("group_payments")
      .select("id, user_id, amount, type, note, created_at, created_by")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: true });
    if (paymentsError) throw new Error(paymentsError.message);

    // Berechne gezahlte Beträge pro user_id, getrennt nach type
    const penaltyPayments = new Map<string, number>();
    const feePayments = new Map<string, number>();
    for (const pay of payments ?? []) {
      if (pay.type === "penalty") {
        const current = penaltyPayments.get(pay.user_id) ?? 0;
        penaltyPayments.set(pay.user_id, current + Number(pay.amount));
      } else if (pay.type === "membership_fee") {
        const current = feePayments.get(pay.user_id) ?? 0;
        feePayments.set(pay.user_id, current + Number(pay.amount));
      }
    }

    // Baue das Ergebnis pro Mitglied
    const memberOverviews = (members ?? []).map((m) => {
      const userId = m.user_id;
      const totalPenalties = penaltySums.get(userId) ?? 0;
      const paidPenalties = penaltyPayments.get(userId) ?? 0;
      const paidFees = feePayments.get(userId) ?? 0;
      const openPenalties = Math.max(0, totalPenalties - paidPenalties);
      const feePaid = paidFees >= membershipFee;
      const openFee = feePaid ? 0 : Math.max(0, membershipFee - paidFees);
      const totalOpen = openPenalties + openFee;
      return {
        userId,
        name: m.profiles?.display_name ?? "Unbekannt",
        role: m.role,
        totalPenalties,
        paidPenalties,
        openPenalties,
        membershipFee,
        paidFees,
        feePaid,
        openFee,
        totalOpen,
      };
    });

    // Gesamtwerte
    const totalOpenAll = memberOverviews.reduce((sum, m) => sum + m.totalOpen, 0);
    const totalOpenPenalties = memberOverviews.reduce((sum, m) => sum + m.openPenalties, 0);
    const openFeeCount = memberOverviews.filter((m) => !m.feePaid).length;

    return {
      groupId: data.groupId,
      membershipFee,
      members: memberOverviews,
      totals: {
        totalOpenAll,
        totalOpenPenalties,
        openFeeCount,
      },
    };
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

    const { error } = await sb.from("group_payments").insert({
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
  .handler(async ({ data, context }) => {
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
      .select("id, role, user_id, profiles(display_name)")
      .eq("group_id", data.groupId);
    if (membersError) throw new Error(membersError.message);

    // 3. Alle Strafen aus Runden dieser Gruppe laden
    // Wir joinen penalties -> round_players -> rounds -> group_id
    const { data: penalties, error: penaltiesError } = await sb
      .from("penalties")
      .select("amount, round_player_id, rounds!inner(group_id), round_players!inner(user_id)")
      .eq("rounds.group_id", data.groupId);
    if (penaltiesError) throw new Error(penaltiesError.message);

    // 4. Alle Zahlungen aus group_payments laden
    const { data: payments, error: paymentsError } = await sb
      .from("group_payments")
      .select("user_id, amount, type")
      .eq("group_id", data.groupId);
    if (paymentsError) throw new Error(paymentsError.message);

    // Aggregation pro Mitglied
    const penaltiesByUser = new Map<string, number>();
    for (const p of penalties ?? []) {
      const userId = (p.round_players as any)?.user_id;
      if (userId) {
        penaltiesByUser.set(userId, (penaltiesByUser.get(userId) ?? 0) + Number(p.amount ?? 0));
      }
    }

    const paidPenaltiesByUser = new Map<string, number>();
    const paidMembershipByUser = new Map<string, number>();
    for (const p of payments ?? []) {
      if (p.type === "penalty") {
        paidPenaltiesByUser.set(p.user_id, (paidPenaltiesByUser.get(p.user_id) ?? 0) + Number(p.amount ?? 0));
      } else if (p.type === "membership_fee") {
        paidMembershipByUser.set(p.user_id, (paidMembershipByUser.get(p.user_id) ?? 0) + Number(p.amount ?? 0));
      }
    }

    const memberFinancials: MemberFinancials[] = (members ?? []).map((m) => {
      const userId = m.user_id;
      const totalPenalties = penaltiesByUser.get(userId) ?? 0;
      const paidPenalties = paidPenaltiesByUser.get(userId) ?? 0;
      const openPenalties = Math.max(0, totalPenalties - paidPenalties);
      const paidMembershipFee = paidMembershipByUser.get(userId) ?? 0;
      const membershipFeeStatus = paidMembershipFee >= membershipFee ? "paid" : "open";
      const totalOpen = openPenalties + (membershipFeeStatus === "open" ? membershipFee : 0);

      return {
        userId,
        name: (m.profiles as any)?.display_name ?? "Unbekannt",
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

    const totalOpenAmount = memberFinancials.reduce((sum, m) => sum + m.totalOpen, 0);
    const totalOpenPenalties = memberFinancials.reduce((sum, m) => sum + m.openPenalties, 0);
    const openMembershipCount = memberFinancials.filter((m) => m.membershipFeeStatus === "open").length;

    return {
      members: memberFinancials,
      totalOpenAmount,
      totalOpenPenalties,
      openMembershipCount,
    };
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
        note: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Prüfen ob Admin
    const { data: isAdmin } = await sb.rpc("is_group_admin", {
      _group_id: data.groupId,
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Nur Gruppen-Admins können Zahlungen verbuchen");

    const { error } = await sb.from("group_payments").insert({
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

export const getMemberPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Prüfen ob der Nutzer Admin ist oder es sich um die eigene Karte handelt
    const { data: isAdmin } = await sb.rpc("is_group_admin", {
      _group_id: data.groupId,
      _user_id: context.userId,
    });
    const isOwn = data.userId === context.userId;
    if (!isAdmin && !isOwn) throw new Error("Keine Berechtigung für diese Ansicht");

    // Historische Strafen aus Runden
    const { data: penalties, error: penaltiesError } = await sb
      .from("penalties")
      .select("amount, code, created_at, rounds!inner(name, played_on), round_players!inner(user_id)")
      .eq("rounds.group_id", data.groupId)
      .eq("round_players.user_id", data.userId)
      .order("created_at", { ascending: false });
    if (penaltiesError) throw new Error(penaltiesError.message);

    // Zahlungen aus group_payments
    const { data: payments, error: paymentsError } = await sb
      .from("group_payments")
      .select("amount, type, note, created_at")
      .eq("group_id", data.groupId)
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false });
    if (paymentsError) throw new Error(paymentsError.message);

    return {
      penalties: (penalties ?? []).map((p) => ({
        amount: Number(p.amount ?? 0),
        code: p.code,
        date: p.created_at,
        roundName: (p.rounds as any)?.name ?? null,
        roundDate: (p.rounds as any)?.played_on ?? null,
      })),
      payments: (payments ?? []).map((p) => ({
        amount: Number(p.amount ?? 0),
        type: p.type,
        note: p.note,
        date: p.created_at,
      })),
    };
  });
