import { Router } from "express";
import { db, usersTable, userRolesTable, groupsTable, groupMembersTable, groupCommissionWithdrawalsTable, registrationsTable, notificationsTable, examsTable, submissionsTable } from "@workspace/db";
import { eq, and, sum, count, desc, ne, sql, ilike, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { sendGroupInviteEmail } from "../lib/email";

const router = Router();

const COMMISSION_RATE = 0.05; // 5%

// ─── ADMIN: list all role holders ───────────────────────────────────────────
router.get("/admin/roles", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: userRolesTable.id,
        userId: userRolesTable.userId,
        role: userRolesTable.role,
        assignedAt: userRolesTable.assignedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userAvatar: usersTable.avatarUrl,
      })
      .from(userRolesTable)
      .leftJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .orderBy(desc(userRolesTable.assignedAt));

    // For each role holder, get their group member count
    const enriched = await Promise.all(rows.map(async (r) => {
      const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, r.userId));
      let memberCount = 0;
      let totalRevenue = "0.00";
      let commission = "0.00";
      if (group) {
        const [mc] = await db.select({ cnt: count() }).from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.status, "accepted")));
        memberCount = mc?.cnt ?? 0;

        // Total exam fees paid by group members
        const members = await db.select({ userId: groupMembersTable.userId })
          .from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.status, "accepted")));
        const memberIds = members.map(m => m.userId);
        if (memberIds.length > 0) {
          let rev = 0;
          for (const uid of memberIds) {
            const [s] = await db.select({ total: sum(registrationsTable.amountPaid) })
              .from(registrationsTable).where(eq(registrationsTable.userId, uid));
            rev += Number(s?.total ?? 0);
          }
          totalRevenue = rev.toFixed(2);
          const [withdrawn] = await db.select({ total: sum(groupCommissionWithdrawalsTable.amount) })
            .from(groupCommissionWithdrawalsTable)
            .where(and(eq(groupCommissionWithdrawalsTable.groupId, group.id), ne(groupCommissionWithdrawalsTable.status, "rejected")));
          commission = (rev * COMMISSION_RATE - Number(withdrawn?.total ?? 0)).toFixed(2);
        }
      }
      return { ...r, groupId: group?.id ?? null, groupName: group?.name ?? null, memberCount, totalRevenue, commission };
    }));

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// ─── ADMIN: assign role to user ──────────────────────────────────────────────
router.post("/admin/users/:userId/roles", requireAdmin, async (req: any, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { role } = req.body;
  const validRoles = ["teacher", "influencer", "promoter", "partner", "premium"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" }); return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Upsert role (ignore if already exists)
    const [existingRole] = await db.select().from(userRolesTable)
      .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.role, role)));
    if (!existingRole) {
      await db.insert(userRolesTable).values({ userId, role, assignedBy: req.user.id });
    }

    // Create group for role holder if they don't have one
    const [existing] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, userId));
    if (!existing) {
      await db.insert(groupsTable).values({ ownerId: userId, name: `${user.name}'s Group` });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to assign role" });
  }
});

// ─── ADMIN: revoke role from user ────────────────────────────────────────────
router.delete("/admin/users/:userId/roles/:role", requireAdmin, async (req: any, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { role } = req.params;
  try {
    await db.delete(userRolesTable)
      .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.role, role as any)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to revoke role" });
  }
});

// ─── ADMIN: get user roles ───────────────────────────────────────────────────
router.get("/admin/users/:userId/roles", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const roles = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  res.json(roles);
});

// ─── ADMIN: commission withdrawals list ─────────────────────────────────────
router.get("/admin/commission-withdrawals", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: groupCommissionWithdrawalsTable.id,
        groupId: groupCommissionWithdrawalsTable.groupId,
        ownerId: groupCommissionWithdrawalsTable.ownerId,
        amount: groupCommissionWithdrawalsTable.amount,
        status: groupCommissionWithdrawalsTable.status,
        utrNumber: groupCommissionWithdrawalsTable.utrNumber,
        upiId: groupCommissionWithdrawalsTable.upiId,
        requestedAt: groupCommissionWithdrawalsTable.requestedAt,
        processedAt: groupCommissionWithdrawalsTable.processedAt,
        ownerName: usersTable.name,
        ownerEmail: usersTable.email,
        groupName: groupsTable.name,
      })
      .from(groupCommissionWithdrawalsTable)
      .leftJoin(usersTable, eq(groupCommissionWithdrawalsTable.ownerId, usersTable.id))
      .leftJoin(groupsTable, eq(groupCommissionWithdrawalsTable.groupId, groupsTable.id))
      .orderBy(desc(groupCommissionWithdrawalsTable.requestedAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch commission withdrawals" });
  }
});

// ─── ADMIN: approve/reject commission withdrawal ─────────────────────────────
router.patch("/admin/commission-withdrawals/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  const { action, utrNumber } = req.body;
  if (!["approve", "reject"].includes(action)) { res.status(400).json({ error: "Invalid action" }); return; }
  try {
    const status = action === "approve" ? "approved" : "rejected";
    await db.update(groupCommissionWithdrawalsTable)
      .set({ status, utrNumber: utrNumber ?? null, processedAt: new Date() })
      .where(eq(groupCommissionWithdrawalsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

// ─── ADMIN: group detail for a specific owner ────────────────────────────────
router.get("/admin/groups/:userId", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!owner) { res.status(404).json({ error: "User not found" }); return; }

    const [role] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, userId));
    if (!group) { res.json({ owner, role: role?.role ?? null, group: null, members: [], stats: {} }); return; }

    // All members (all statuses)
    const members = await db
      .select({
        id: groupMembersTable.id,
        userId: groupMembersTable.userId,
        status: groupMembersTable.status,
        invitedAt: groupMembersTable.invitedAt,
        joinedAt: groupMembersTable.joinedAt,
        name: usersTable.name,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(groupMembersTable)
      .leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
      .where(eq(groupMembersTable.groupId, group.id))
      .orderBy(desc(groupMembersTable.invitedAt));

    // Per-member stats
    const membersWithStats = await Promise.all(members.map(async (m) => {
      const [examCount] = await db.select({ cnt: count() }).from(registrationsTable)
        .where(eq(registrationsTable.userId, m.userId));
      const [spent] = await db.select({ total: sum(registrationsTable.amountPaid) }).from(registrationsTable)
        .where(eq(registrationsTable.userId, m.userId));
      const totalSpent = Number(spent?.total ?? 0);
      return {
        ...m,
        examsTaken: examCount?.cnt ?? 0,
        totalSpent: totalSpent.toFixed(2),
        commission: (totalSpent * COMMISSION_RATE).toFixed(2),
      };
    }));

    // Group-level totals (accepted only)
    const accepted = membersWithStats.filter(m => m.status === "accepted");
    const totalRevenue = accepted.reduce((s, m) => s + Number(m.totalSpent), 0);
    const totalCommission = totalRevenue * COMMISSION_RATE;
    const [withdrawn] = await db.select({ total: sum(groupCommissionWithdrawalsTable.amount) })
      .from(groupCommissionWithdrawalsTable)
      .where(and(eq(groupCommissionWithdrawalsTable.groupId, group.id), ne(groupCommissionWithdrawalsTable.status, "rejected")));
    const availableCommission = Math.max(0, totalCommission - Number(withdrawn?.total ?? 0));

    res.json({
      owner: { id: owner.id, name: owner.name, email: owner.email, avatarUrl: owner.avatarUrl },
      role: role?.role ?? null,
      group: { id: group.id, name: group.name, createdAt: group.createdAt },
      members: membersWithStats,
      stats: {
        totalMembers: accepted.length,
        pendingInvites: members.filter(m => m.status === "pending").length,
        totalRevenue: totalRevenue.toFixed(2),
        totalCommission: totalCommission.toFixed(2),
        availableCommission: availableCommission.toFixed(2),
        withdrawnAmount: Number(withdrawn?.total ?? 0).toFixed(2),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch group detail" });
  }
});

// ─── LOOKUP USER BY UID (before invite, shows user card) ─────────────────────
router.get("/groups/lookup-user", requireAuth, async (req: any, res) => {
  const rawUid = String(req.query.uid ?? "").replace(/[^0-9]/g, "");
  const targetId = parseInt(rawUid, 10);
  if (!targetId || isNaN(targetId)) { res.status(400).json({ error: "Invalid UID" }); return; }
  try {
    const [user] = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl,
    }).from(usersTable).where(eq(usersTable.id, targetId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.id === req.user.id) { res.status(400).json({ error: "Aap khud ko invite nahi kar sakte" }); return; }
    res.json(user);
  } catch { res.status(500).json({ error: "Lookup failed" }); }
});

// ─── PENDING INVITE COUNT (for badge on profile) ─────────────────────────────
router.get("/groups/pending-invites-count", requireAuth, async (req: any, res) => {
  try {
    const [{ cnt }] = await db.select({ cnt: count() }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.userId, req.user.id), eq(groupMembersTable.status, "pending")));
    res.json({ count: cnt ?? 0 });
  } catch { res.json({ count: 0 }); }
});

// ─── MEMBER DETAIL: exam history + stats (for group owner to view) ───────────
router.get("/groups/members/:memberId/detail", requireAuth, async (req: any, res) => {
  const memberId = parseInt(req.params.memberId, 10);
  try {
    // Verify requester is group owner and memberId is in their group
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.status(403).json({ error: "You don't own a group" }); return; }
    const [membership] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, memberId), eq(groupMembersTable.status, "accepted")));
    if (!membership) { res.status(403).json({ error: "Member not in your group" }); return; }

    const [member] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl })
      .from(usersTable).where(eq(usersTable.id, memberId));

    // All registrations with exam info
    const regs = await db.select({
      examId: registrationsTable.examId,
      amountPaid: registrationsTable.amountPaid,
      status: registrationsTable.status,
      registeredAt: registrationsTable.registeredAt,
      examTitle: examsTable.title,
      examCategory: examsTable.category,
      examStatus: examsTable.status,
      examStartTime: examsTable.startTime,
    }).from(registrationsTable)
      .leftJoin(examsTable, eq(registrationsTable.examId, examsTable.id))
      .where(eq(registrationsTable.userId, memberId))
      .orderBy(desc(registrationsTable.registeredAt));

    // Submissions (score, rank)
    const subs = await db.select({
      examId: submissionsTable.examId,
      score: submissionsTable.score,
      totalQuestions: submissionsTable.totalQuestions,
      correctAnswers: submissionsTable.correctAnswers,
      rank: submissionsTable.rank,
      submittedAt: submissionsTable.submittedAt,
    }).from(submissionsTable).where(eq(submissionsTable.userId, memberId));
    const subMap = Object.fromEntries(subs.map(s => [s.examId, s]));

    const exams = regs.map(r => ({
      ...r,
      submission: subMap[r.examId!] ?? null,
    }));

    const totalSpent = regs.reduce((s, r) => s + Number(r.amountPaid ?? 0), 0);
    const commission = totalSpent * COMMISSION_RATE;

    res.json({
      member,
      joinedAt: membership.joinedAt,
      exams,
      stats: {
        examsTaken: regs.length,
        totalSpent: totalSpent.toFixed(2),
        commission: commission.toFixed(2),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch member detail" });
  }
});

// ─── MY ROLES (mobile) ───────────────────────────────────────────────────────
router.get("/roles/my", requireAuth, async (req: any, res) => {
  const roles = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, req.user.id));
  res.json(roles.map(r => r.role));
});

// ─── MY GROUP (as owner) ─────────────────────────────────────────────────────
router.get("/groups/my", requireAuth, async (req: any, res) => {
  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.json(null); return; }

    const members = await db
      .select({
        id: groupMembersTable.id,
        userId: groupMembersTable.userId,
        status: groupMembersTable.status,
        joinedAt: groupMembersTable.joinedAt,
        name: usersTable.name,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(groupMembersTable)
      .leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
      .where(eq(groupMembersTable.groupId, group.id))
      .orderBy(desc(groupMembersTable.invitedAt));

    // Commission calculation
    const accepted = members.filter(m => m.status === "accepted");
    let totalRevenue = 0;
    for (const m of accepted) {
      const [s] = await db.select({ total: sum(registrationsTable.amountPaid) })
        .from(registrationsTable).where(eq(registrationsTable.userId, m.userId));
      totalRevenue += Number(s?.total ?? 0);
    }
    const [withdrawn] = await db.select({ total: sum(groupCommissionWithdrawalsTable.amount) })
      .from(groupCommissionWithdrawalsTable)
      .where(and(eq(groupCommissionWithdrawalsTable.groupId, group.id), ne(groupCommissionWithdrawalsTable.status, "rejected")));
    const totalCommission = totalRevenue * COMMISSION_RATE;
    const availableCommission = Math.max(0, totalCommission - Number(withdrawn?.total ?? 0));

    res.json({
      ...group,
      members,
      totalRevenue: totalRevenue.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      availableCommission: availableCommission.toFixed(2),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch group" });
  }
});

// ─── RENAME GROUP ─────────────────────────────────────────────────────────────
router.patch("/groups/my", requireAuth, async (req: any, res) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Group name required" }); return; }
  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    // Duplicate name check (case-insensitive, excluding own group)
    const [dupName] = await db.select({ id: groupsTable.id }).from(groupsTable)
      .where(and(ilike(groupsTable.name, name.trim()), ne(groupsTable.id, group.id)));
    if (dupName) {
      res.status(400).json({ error: `"${name.trim()}" naam ka group pehle se exist karta hai. Koi aur naam choose karein.` }); return;
    }
    await db.update(groupsTable).set({ name: name.trim(), updatedAt: new Date() }).where(eq(groupsTable.id, group.id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to rename group" });
  }
});

// ─── INVITE MEMBER by UID ─────────────────────────────────────────────────────
router.post("/groups/my/invite", requireAuth, async (req: any, res) => {
  const { uid } = req.body; // UID is padded like RY0000000074 → extract numeric id
  const rawUid = String(uid ?? "").replace(/[^0-9]/g, "");
  const targetId = parseInt(rawUid, 10);
  if (!targetId || isNaN(targetId)) { res.status(400).json({ error: "Invalid UID" }); return; }

  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.status(404).json({ error: "You don't have a group" }); return; }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
    if (!target) { res.status(404).json({ error: "User not found with this UID" }); return; }
    if (target.id === req.user.id) { res.status(400).json({ error: "You can't invite yourself" }); return; }

    // Check if already a member of THIS group (pending or accepted)
    const [existingThisGroup] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, target.id)));
    if (existingThisGroup) {
      const msg = existingThisGroup.status === "accepted"
        ? `${target.name} already a part of "${group.name}" group`
        : `${target.name} ko invite pehle se bheja ja chuka hai`;
      res.status(400).json({ error: msg }); return;
    }
    // Check if target is already accepted member of ANY other group
    const [alreadyInOtherGroup] = await db
      .select({ groupName: groupsTable.name })
      .from(groupMembersTable)
      .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
      .where(and(eq(groupMembersTable.userId, target.id), eq(groupMembersTable.status, "accepted")));
    if (alreadyInOtherGroup) {
      res.status(400).json({ error: `${target.name} already a part of "${alreadyInOtherGroup.groupName}" group` }); return;
    }

    const [newMember] = await db.insert(groupMembersTable).values({ groupId: group.id, userId: target.id, status: "pending" }).returning({ id: groupMembersTable.id });

    // Send in-app notification + email to target user
    try {
      const [ownerUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
      await db.insert(notificationsTable).values({
        userId: target.id,
        type: "group_invite",
        title: "Group Invitation",
        body: `${ownerUser.name} ne aapko "${group.name}" group mein invite kiya hai`,
        data: JSON.stringify({ groupId: group.id, groupName: group.name, inviterId: req.user.id, inviteId: newMember?.id }),
        isRead: false,
      });
      // Send email invite
      sendGroupInviteEmail(target.email, target.name, ownerUser.name, group.name).catch((err) => {
        console.error("[group invite email failed]", err?.message);
      });
    } catch {}

    res.json({ ok: true, targetName: target.name });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// ─── MY PENDING INVITES (as member) ──────────────────────────────────────────
router.get("/groups/invites", requireAuth, async (req: any, res) => {
  try {
    const invites = await db
      .select({
        id: groupMembersTable.id,
        groupId: groupMembersTable.groupId,
        status: groupMembersTable.status,
        invitedAt: groupMembersTable.invitedAt,
        groupName: groupsTable.name,
        ownerName: usersTable.name,
        ownerAvatar: usersTable.avatarUrl,
      })
      .from(groupMembersTable)
      .leftJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
      .leftJoin(usersTable, eq(groupsTable.ownerId, usersTable.id))
      .where(and(eq(groupMembersTable.userId, req.user.id), eq(groupMembersTable.status, "pending")));
    res.json(invites);
  } catch {
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});

// ─── MY MEMBERSHIPS ──────────────────────────────────────────────────────────
router.get("/groups/memberships", requireAuth, async (req: any, res) => {
  try {
    const memberships = await db
      .select({
        id: groupMembersTable.id,
        groupId: groupMembersTable.groupId,
        status: groupMembersTable.status,
        joinedAt: groupMembersTable.joinedAt,
        groupName: groupsTable.name,
        ownerName: usersTable.name,
        ownerAvatar: usersTable.avatarUrl,
      })
      .from(groupMembersTable)
      .leftJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
      .leftJoin(usersTable, eq(groupsTable.ownerId, usersTable.id))
      .where(and(eq(groupMembersTable.userId, req.user.id), eq(groupMembersTable.status, "accepted")));
    res.json(memberships);
  } catch {
    res.status(500).json({ error: "Failed to fetch memberships" });
  }
});

// ─── ACCEPT / DECLINE INVITE ─────────────────────────────────────────────────
router.patch("/groups/invites/:inviteId", requireAuth, async (req: any, res) => {
  const inviteId = parseInt(req.params.inviteId, 10);
  const { action } = req.body; // "accept" | "decline"
  if (!["accept", "decline"].includes(action)) { res.status(400).json({ error: "Invalid action" }); return; }

  try {
    const [invite] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.id, inviteId), eq(groupMembersTable.userId, req.user.id)));
    if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }

    const status = action === "accept" ? "accepted" : "declined";
    await db.update(groupMembersTable)
      .set({ status, joinedAt: action === "accept" ? new Date() : null })
      .where(eq(groupMembersTable.id, inviteId));

    if (action === "accept") {
      // Get group name for badge
      const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, invite.groupId));
      res.json({ ok: true, groupName: group?.name ?? "Group" });
    } else {
      res.json({ ok: true });
    }
  } catch {
    res.status(500).json({ error: "Failed to process invite" });
  }
});

// ─── GROUP MEMBER STATS (exam activity) ──────────────────────────────────────
router.get("/groups/my/member-stats", requireAuth, async (req: any, res) => {
  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.json([]); return; }

    const members = await db
      .select({ userId: groupMembersTable.userId, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(groupMembersTable)
      .leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.status, "accepted")));

    const stats = await Promise.all(members.map(async (m) => {
      const [examCount] = await db.select({ cnt: count() }).from(registrationsTable)
        .where(eq(registrationsTable.userId, m.userId));
      const [spent] = await db.select({ total: sum(registrationsTable.amountPaid) }).from(registrationsTable)
        .where(eq(registrationsTable.userId, m.userId));
      return {
        userId: m.userId,
        name: m.name,
        avatarUrl: m.avatarUrl,
        examsTaken: examCount?.cnt ?? 0,
        totalSpent: spent?.total ?? "0.00",
        commission: (Number(spent?.total ?? 0) * COMMISSION_RATE).toFixed(2),
      };
    }));

    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to fetch member stats" });
  }
});

// ─── WITHDRAW COMMISSION ─────────────────────────────────────────────────────
router.post("/groups/my/commission/withdraw", requireAuth, async (req: any, res) => {
  const { amount, upiId } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  if (!upiId?.trim()) { res.status(400).json({ error: "UPI ID required" }); return; }

  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }

    // Check available commission
    const members = await db.select({ userId: groupMembersTable.userId }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.status, "accepted")));
    let totalRevenue = 0;
    for (const m of members) {
      const [s] = await db.select({ total: sum(registrationsTable.amountPaid) })
        .from(registrationsTable).where(eq(registrationsTable.userId, m.userId));
      totalRevenue += Number(s?.total ?? 0);
    }
    const [withdrawn] = await db.select({ total: sum(groupCommissionWithdrawalsTable.amount) })
      .from(groupCommissionWithdrawalsTable)
      .where(and(eq(groupCommissionWithdrawalsTable.groupId, group.id), ne(groupCommissionWithdrawalsTable.status, "rejected")));
    const available = totalRevenue * COMMISSION_RATE - Number(withdrawn?.total ?? 0);

    if (amt > available) {
      res.status(400).json({ error: `Insufficient commission. Available: ₹${available.toFixed(2)}` }); return;
    }

    await db.insert(groupCommissionWithdrawalsTable).values({
      groupId: group.id,
      ownerId: req.user.id,
      amount: String(amt),
      upiId: upiId.trim(),
      status: "pending",
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to request withdrawal" });
  }
});

// ─── GROUP PHOTO UPLOAD (owner only, base64) ─────────────────────────────────
router.post("/groups/my/photo", requireAuth, async (req: any, res) => {
  const { photoBase64, mimeType } = req.body;
  if (!photoBase64 || !mimeType) { res.status(400).json({ error: "Missing photoBase64 or mimeType" }); return; }
  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.ownerId, req.user.id));
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    const photoUrl = `data:${mimeType};base64,${photoBase64}`;
    await db.update(groupsTable).set({ photoUrl, updatedAt: new Date() }).where(eq(groupsTable.id, group.id));
    res.json({ ok: true, photoUrl });
  } catch {
    res.status(500).json({ error: "Failed to upload group photo" });
  }
});

// ─── EXPLORE ALL GROUPS (public browse + search) ─────────────────────────────
router.get("/groups/explore", requireAuth, async (req: any, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = 30;
  try {
    const userId = req.user.id;

    const rows = await db
      .select({
        id: groupsTable.id,
        name: groupsTable.name,
        photoUrl: groupsTable.photoUrl,
        ownerId: groupsTable.ownerId,
        ownerName: usersTable.name,
        ownerAvatar: usersTable.avatarUrl,
        createdAt: groupsTable.createdAt,
        memberCount: sql<number>`(SELECT COUNT(*) FROM group_members WHERE group_id = ${groupsTable.id} AND status = 'accepted')::int`,
        isJoined: sql<boolean>`EXISTS(SELECT 1 FROM group_members WHERE group_id = ${groupsTable.id} AND user_id = ${userId} AND status = 'accepted')`,
        isOwner: sql<boolean>`${groupsTable.ownerId} = ${userId}`,
      })
      .from(groupsTable)
      .leftJoin(usersTable, eq(groupsTable.ownerId, usersTable.id))
      .where(q
        ? or(
            ilike(groupsTable.name, `%${q}%`),
            !isNaN(Number(q)) ? eq(groupsTable.id, Number(q)) : sql`false`,
          )
        : undefined
      )
      .orderBy(desc(sql<number>`(SELECT COUNT(*) FROM group_members WHERE group_id = ${groupsTable.id} AND status = 'accepted')`))
      .limit(limit);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// ─── SELF-JOIN A GROUP (auto-accept) ─────────────────────────────────────────
router.post("/groups/:groupId/join", requireAuth, async (req: any, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  try {
    const userId = req.user.id;

    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    if (group.ownerId === userId) { res.status(400).json({ error: "Aap is group ke owner hain" }); return; }

    const [existing] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));

    if (existing) {
      if (existing.status === "accepted") { res.status(400).json({ error: "Aap pehle se is group mein hain" }); return; }
      await db.update(groupMembersTable)
        .set({ status: "accepted", joinedAt: new Date() })
        .where(eq(groupMembersTable.id, existing.id));
    } else {
      await db.insert(groupMembersTable).values({ groupId, userId, status: "accepted", joinedAt: new Date() });
    }

    res.json({ ok: true, groupName: group.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to join group" });
  }
});

// ─── LEAVE A GROUP ────────────────────────────────────────────────────────────
router.delete("/groups/:groupId/leave", requireAuth, async (req: any, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  try {
    const userId = req.user.id;

    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    if (group.ownerId === userId) { res.status(400).json({ error: "Owner group nahi chhod sakta" }); return; }

    const [member] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));
    if (!member) { res.status(404).json({ error: "Aap is group ke member nahi hain" }); return; }

    await db.delete(groupMembersTable).where(eq(groupMembersTable.id, member.id));

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to leave group" });
  }
});

export default router;
