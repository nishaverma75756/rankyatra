import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showConfirm } from "@/utils/alert";
import { useFocusEffect } from "expo-router";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const ROLE_COLORS: Record<string, string> = {
  teacher: "#2563eb", influencer: "#7c3aed", promoter: "#d97706",
  partner: "#059669", premium: "#f97316",
};
const ROLE_ICONS: Record<string, string> = {
  teacher: "book-open", influencer: "star", promoter: "volume-2",
  partner: "link", premium: "award",
};

function formatCurrency(v: any) {
  return `₹${Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function GroupDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [group, setGroup] = useState<any>(null);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [memberStats, setMemberStats] = useState<any[]>([]);
  const [myMemberships, setMyMemberships] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"group" | "member">("group");

  const [inviteUid, setInviteUid] = useState("");
  const [inviting, setInviting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showRename, setShowRename] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [rolesR, groupR, statsR, membershipsR, invitesR] = await Promise.all([
        fetch(`${BASE_URL}/api/roles/my`, { headers: h }),
        fetch(`${BASE_URL}/api/groups/my`, { headers: h }),
        fetch(`${BASE_URL}/api/groups/my/member-stats`, { headers: h }),
        fetch(`${BASE_URL}/api/groups/memberships`, { headers: h }),
        fetch(`${BASE_URL}/api/groups/invites`, { headers: h }),
      ]);
      const roles = rolesR.ok ? await rolesR.json() : [];
      const grp   = groupR.ok ? await groupR.json() : null;
      const stats = statsR.ok ? await statsR.json() : [];
      const mems  = membershipsR.ok ? await membershipsR.json() : [];
      const invs  = invitesR.ok ? await invitesR.json() : [];
      setMyRoles(roles);
      setGroup(grp);
      setMemberStats(stats);
      setMyMemberships(mems);
      setPendingInvites(invs);
    } catch {}
  }, [token]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!inviteUid.trim()) { showError("Enter UID", "UID enter karo (e.g. 74)"); return; }
    setInviting(true);
    try {
      const r = await fetch(`${BASE_URL}/api/groups/my/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uid: inviteUid.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setInviteUid("");
      showError("Invitation Sent!", `${d.targetName} ko invite bhej diya`);
      fetchAll();
    } catch (e: any) {
      showError("Error", e.message);
    } finally { setInviting(false); }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    setRenaming(true);
    try {
      const r = await fetch(`${BASE_URL}/api/groups/my`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowRename(false);
      fetchAll();
    } catch (e: any) {
      showError("Error", e.message);
    } finally { setRenaming(false); }
  };

  const handleInviteResponse = async (inviteId: number, action: "accept" | "decline") => {
    try {
      const r = await fetch(`${BASE_URL}/api/groups/invites/${inviteId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      fetchAll();
    } catch (e: any) {
      showError("Error", e.message);
    }
  };

  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) { showError("Invalid Amount", "Valid amount enter karo"); return; }
    if (!withdrawUpi.trim()) { showError("UPI Required", "Apna UPI ID enter karo"); return; }
    setWithdrawing(true);
    try {
      const r = await fetch(`${BASE_URL}/api/groups/my/commission/withdraw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, upiId: withdrawUpi.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawUpi("");
      showError("Request Submitted!", "Commission withdrawal request admin ko bhej di gayi");
      fetchAll();
    } catch (e: any) {
      showError("Error", e.message);
    } finally { setWithdrawing(false); }
  };

  const isOwner = myRoles.length > 0;
  const mainRole = myRoles[0];
  const roleColor = mainRole ? (ROLE_COLORS[mainRole] ?? "#f97316") : "#f97316";

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerTitle}>
          <Text style={[s.headerText, { color: colors.foreground }]}>Group Dashboard</Text>
          {mainRole && (
            <View style={[s.roleBadge, { backgroundColor: roleColor + "20" }]}>
              <Feather name={ROLE_ICONS[mainRole] as any ?? "user"} size={11} color={roleColor} />
              <Text style={[s.roleBadgeText, { color: roleColor }]}>{mainRole.charAt(0).toUpperCase() + mainRole.slice(1)}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#f97316" size="large" /></View>
      ) : (
        <>
          {/* Tabs */}
          {isOwner && myMemberships.length > 0 && (
            <View style={[s.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              {[["group", "My Group"], ["member", "My Memberships"]].map(([t, label]) => (
                <TouchableOpacity key={t} onPress={() => setTab(t as any)} style={[s.tab, tab === t && { borderBottomColor: roleColor }]}>
                  <Text style={[s.tabText, { color: tab === t ? roleColor : colors.mutedForeground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Pending invites (always visible) ── */}
            {pendingInvites.length > 0 && (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: "#f97316" }]}>
                <Text style={[s.cardTitle, { color: colors.foreground }]}>Group Invitations ({pendingInvites.length})</Text>
                {pendingInvites.map((inv) => (
                  <View key={inv.id} style={s.inviteRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.inviteName, { color: colors.foreground }]}>{inv.ownerName}</Text>
                      <Text style={[s.inviteSub, { color: colors.mutedForeground }]}>"{inv.groupName}" group mein invite</Text>
                    </View>
                    <View style={s.inviteActions}>
                      <TouchableOpacity style={[s.acceptBtn, { backgroundColor: "#22c55e" }]} onPress={() => handleInviteResponse(inv.id, "accept")}>
                        <Feather name="check" size={14} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.acceptBtn, { backgroundColor: "#ef4444" }]} onPress={() => handleInviteResponse(inv.id, "decline")}>
                        <Feather name="x" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {tab === "member" ? (
              /* ── Memberships ── */
              <View>
                {myMemberships.length === 0 ? (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 14 }}>Kisi group ke member nahi hain</Text>
                  </View>
                ) : myMemberships.map((m) => (
                  <View key={m.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>{m.groupName}</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground }]}>Owner: {m.ownerName}</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground }]}>
                      Joined: {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("en-IN") : "—"}
                    </Text>
                    <View style={[s.memberBadge, { backgroundColor: "#22c55e20" }]}>
                      <Feather name="check-circle" size={12} color="#22c55e" />
                      <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>{m.groupName} Member</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              /* ── Owner Dashboard ── */
              isOwner ? (
                <View>
                  {/* Group name + rename */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View>
                        <Text style={[s.groupName, { color: colors.foreground }]}>{group?.name ?? "My Group"}</Text>
                        <Text style={[s.sub, { color: colors.mutedForeground }]}>{group?.members?.filter((m: any) => m.status === "accepted").length ?? 0} active members</Text>
                      </View>
                      <TouchableOpacity onPress={() => { setNewName(group?.name ?? ""); setShowRename(true); }}
                        style={[s.editBtn, { backgroundColor: colors.muted }]}>
                        <Feather name="edit-2" size={15} color={colors.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Commission card */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: "#f97316", borderWidth: 1.5 }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>Commission (5%)</Text>
                    <View style={s.commRow}>
                      <View style={s.commStat}>
                        <Text style={[s.commVal, { color: "#22c55e" }]}>{formatCurrency(group?.totalRevenue)}</Text>
                        <Text style={[s.commLabel, { color: colors.mutedForeground }]}>Member Revenue</Text>
                      </View>
                      <View style={s.commStat}>
                        <Text style={[s.commVal, { color: "#f97316" }]}>{formatCurrency(group?.availableCommission)}</Text>
                        <Text style={[s.commLabel, { color: colors.mutedForeground }]}>Available</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[s.withdrawBtn, { backgroundColor: "#f97316", opacity: Number(group?.availableCommission ?? 0) > 0 ? 1 : 0.4 }]}
                      disabled={Number(group?.availableCommission ?? 0) <= 0}
                      onPress={() => setShowWithdraw(true)}
                    >
                      <Feather name="download" size={15} color="#fff" />
                      <Text style={s.withdrawBtnText}>Withdraw Commission</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Invite member */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>Invite Member</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground, marginBottom: 10 }]}>User ka UID daalo (e.g. 74 ya RY0000000074)</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        style={[s.input, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                        placeholder="User UID"
                        placeholderTextColor={colors.mutedForeground}
                        value={inviteUid}
                        onChangeText={setInviteUid}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity style={[s.inviteBtn, { backgroundColor: "#f97316" }]} onPress={handleInvite} disabled={inviting}>
                        {inviting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.inviteBtnText}>Invite</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Members list */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>Members ({group?.members?.length ?? 0})</Text>
                    {(group?.members ?? []).length === 0 ? (
                      <Text style={[s.sub, { color: colors.mutedForeground }]}>Abhi tak koi member nahi</Text>
                    ) : (group?.members ?? []).map((m: any) => {
                      const stat = memberStats.find((s: any) => s.userId === m.userId);
                      return (
                        <View key={m.id} style={[s.memberRow, { borderTopColor: colors.border }]}>
                          {m.avatarUrl ? (
                            <Image
                              source={{ uri: m.avatarUrl.startsWith("http") ? m.avatarUrl : `${BASE_URL}${m.avatarUrl}` }}
                              style={{ width: 38, height: 38, borderRadius: 19 }}
                            />
                          ) : (
                            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#f97316", alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{(m.name ?? "?")[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[s.memberName, { color: colors.foreground }]}>{m.name}</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <Text style={[s.sub, { color: colors.mutedForeground }]}>Exams: {stat?.examsTaken ?? 0}</Text>
                              <Text style={[s.sub, { color: colors.mutedForeground }]}>Spent: {formatCurrency(stat?.totalSpent)}</Text>
                            </View>
                          </View>
                          <View style={[s.statusBadge, {
                            backgroundColor: m.status === "accepted" ? "#22c55e20" : m.status === "pending" ? "#f9731620" : "#ef444420"
                          }]}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: m.status === "accepted" ? "#22c55e" : m.status === "pending" ? "#f97316" : "#ef4444" }}>
                              {m.status}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* Not an owner but can see memberships */
                myMemberships.length > 0 ? (
                  myMemberships.map((m) => (
                    <View key={m.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[s.cardTitle, { color: colors.foreground }]}>{m.groupName}</Text>
                      <Text style={[s.sub, { color: colors.mutedForeground }]}>Owner: {m.ownerName}</Text>
                      <View style={[s.memberBadge, { backgroundColor: "#22c55e20" }]}>
                        <Feather name="check-circle" size={12} color="#22c55e" />
                        <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>{m.groupName} Member</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 14 }}>Kisi group ke member nahi hain</Text>
                  </View>
                )
              )
            )}
          </ScrollView>
        </>
      )}

      {/* Rename Modal */}
      <Modal visible={showRename} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Group Rename Karo</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Group name"
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: colors.muted }]} onPress={() => setShowRename(false)}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: "#f97316" }]} onPress={handleRename} disabled={renaming}>
                {renaming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdraw Commission Modal */}
      <Modal visible={showWithdraw} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Commission Withdraw</Text>
            <Text style={[s.sub, { color: colors.mutedForeground, marginBottom: 12 }]}>
              Available: {formatCurrency(group?.availableCommission)}
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="Amount (₹)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, marginTop: 8 }]}
              value={withdrawUpi}
              onChangeText={setWithdrawUpi}
              placeholder="UPI ID (e.g. abc@upi)"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: colors.muted }]} onPress={() => setShowWithdraw(false)}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: "#f97316" }]} onPress={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { fontSize: 17, fontWeight: "800" },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontWeight: "700" },
  scroll: { padding: 16, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: "800", marginBottom: 10 },
  groupName: { fontSize: 20, fontWeight: "900" },
  sub: { fontSize: 12 },
  editBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  commRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  commStat: { flex: 1, alignItems: "center", padding: 10, borderRadius: 12, backgroundColor: "#f9f9f9" },
  commVal: { fontSize: 18, fontWeight: "900" },
  commLabel: { fontSize: 11, marginTop: 2 },
  withdrawBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 12 },
  withdrawBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  inviteBtn: { paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", minWidth: 70 },
  inviteBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", paddingTop: 12, marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  memberName: { fontSize: 14, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start", marginTop: 8 },
  inviteRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inviteName: { fontSize: 13, fontWeight: "700" },
  inviteSub: { fontSize: 12 },
  inviteActions: { flexDirection: "row", gap: 6 },
  acceptBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12 },
  modalBtn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
});
