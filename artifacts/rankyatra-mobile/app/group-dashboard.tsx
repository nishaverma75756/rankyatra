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
import * as ImagePicker from "expo-image-picker";

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
function formatDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
  const [failedAvatars, setFailedAvatars] = useState<Set<number>>(new Set());

  // Invite flow — search first, then confirm
  const [inviteUid, setInviteUid] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [inviting, setInviting] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const pickGroupPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { showError("Gallery permission chahiye"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { showError("Image Error", "Failed to process the image."); return; }
    const mimeType = asset.mimeType ?? "image/jpeg";
    setUploadingPhoto(true);
    try {
      const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const res = await fetch(`${BASE_URL}/api/groups/my/photo`, {
        method: "POST", headers: h,
        body: JSON.stringify({ photoBase64: asset.base64, mimeType }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroup((prev: any) => prev ? { ...prev, photoUrl: data.photoUrl } : prev);
    } catch {
      showError("Upload Failed", "Photo could not be uploaded.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showRename, setShowRename] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Member detail modal
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberDetail, setMemberDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  // Step 1: Search user by UID
  const handleSearch = async () => {
    if (!inviteUid.trim()) { showError("UID Required", "Please enter the user's UID."); return; }
    setSearching(true);
    setFoundUser(null);
    try {
      const r = await fetch(`${BASE_URL}/api/groups/lookup-user?uid=${encodeURIComponent(inviteUid.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "User not found");
      setFoundUser(d);
    } catch (e: any) {
      showError("User Not Found", e.message);
    } finally { setSearching(false); }
  };

  // Step 2: Confirm and send invite
  const handleConfirmInvite = async () => {
    if (!foundUser) return;
    setInviting(true);
    try {
      const r = await fetch(`${BASE_URL}/api/groups/my/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uid: foundUser.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setInviteUid("");
      setFoundUser(null);
      showError("Invitation Bhej Di!", `${d.targetName} ko group invite aur email notification bhej di gayi`);
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
    if (!amt || amt <= 0) { showError("Invalid Amount", "Please enter a valid amount."); return; }
    if (!withdrawUpi.trim()) { showError("UPI Required", "Please enter your UPI ID."); return; }
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

  // Open member detail modal
  const openMemberDetail = async (member: any) => {
    setSelectedMember(member);
    setMemberDetail(null);
    setLoadingDetail(true);
    try {
      const r = await fetch(`${BASE_URL}/api/groups/members/${member.userId}/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMemberDetail(d);
    } catch (e: any) {
      showError("Error", e.message);
      setSelectedMember(null);
    } finally { setLoadingDetail(false); }
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
            {/* Pending invites */}
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
              <View>
                {myMemberships.length === 0 ? (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 14 }}>You are not a member of any group</Text>
                  </View>
                ) : myMemberships.map((m) => (
                  <View key={m.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>{m.groupName}</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground }]}>Owner: {m.ownerName}</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground }]}>Joined: {formatDate(m.joinedAt)}</Text>
                    <View style={[s.memberBadge, { backgroundColor: "#22c55e20" }]}>
                      <Feather name="check-circle" size={12} color="#22c55e" />
                      <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>{m.groupName} Member</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              isOwner ? (
                <View>
                  {/* Group photo + name + rename */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      {/* Group photo with upload button */}
                      <TouchableOpacity onPress={pickGroupPhoto} disabled={uploadingPhoto} style={{ position: "relative" }}>
                        {group?.photoUrl ? (
                          <Image source={{ uri: group.photoUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                        ) : (
                          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#f9731620", alignItems: "center", justifyContent: "center" }}>
                            <Feather name="users" size={28} color="#f97316" />
                          </View>
                        )}
                        <View style={{
                          position: "absolute", bottom: 0, right: 0,
                          width: 22, height: 22, borderRadius: 11,
                          backgroundColor: "#f97316", alignItems: "center", justifyContent: "center",
                          borderWidth: 2, borderColor: colors.card,
                        }}>
                          {uploadingPhoto
                            ? <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.6 }] }} />
                            : <Feather name="camera" size={11} color="#fff" />
                          }
                        </View>
                      </TouchableOpacity>
                      {/* Group info */}
                      <View style={{ flex: 1 }}>
                        <Text style={[s.groupName, { color: colors.foreground }]}>{group?.name ?? "My Group"}</Text>
                        <Text style={[s.sub, { color: colors.mutedForeground }]}>{group?.members?.filter((m: any) => m.status === "accepted").length ?? 0} active members</Text>
                      </View>
                      <TouchableOpacity onPress={() => { setNewName(group?.name ?? ""); setShowRename(true); }}
                        style={[s.editBtn, { backgroundColor: colors.muted }]}>
                        <Feather name="edit-2" size={15} color={colors.foreground} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 8 }}>Tap on the photo to change group picture</Text>
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

                  {/* ── INVITE MEMBER: Search first, then confirm ── */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>Invite Member</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground, marginBottom: 10 }]}>Enter user UID (e.g. 74 or RY0000000074)</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        style={[s.input, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: foundUser ? "#22c55e" : colors.border }]}
                        placeholder="User UID"
                        placeholderTextColor={colors.mutedForeground}
                        value={inviteUid}
                        onChangeText={(t) => { setInviteUid(t); setFoundUser(null); }}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[s.inviteBtn, { backgroundColor: "#f97316" }]}
                        onPress={handleSearch}
                        disabled={searching}
                      >
                        {searching
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <><Feather name="search" size={15} color="#fff" /><Text style={s.inviteBtnText}> Search</Text></>
                        }
                      </TouchableOpacity>
                    </View>

                    {/* Found user card */}
                    {foundUser && (
                      <View style={[s.foundUserCard, { backgroundColor: colors.muted, borderColor: "#22c55e" }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          {foundUser.avatarUrl ? (
                            <Image source={{ uri: foundUser.avatarUrl.startsWith("http") ? foundUser.avatarUrl : `${BASE_URL}${foundUser.avatarUrl}` }}
                              style={s.foundAvatar} />
                          ) : (
                            <View style={[s.foundAvatar, { backgroundColor: "#f97316", alignItems: "center", justifyContent: "center" }]}>
                              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{(foundUser.name ?? "?")[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[{ fontWeight: "800", fontSize: 14, color: colors.foreground }]}>{foundUser.name}</Text>
                            <Text style={[s.sub, { color: colors.mutedForeground }]}>{foundUser.email}</Text>
                          </View>
                          <Feather name="check-circle" size={18} color="#22c55e" />
                        </View>
                        <Text style={[s.sub, { color: colors.mutedForeground, marginTop: 8, marginBottom: 8 }]}>
                          Are you sure you want to invite this user to the group?
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            style={[s.modalBtn, { flex: 1, backgroundColor: colors.border }]}
                            onPress={() => { setFoundUser(null); setInviteUid(""); }}
                          >
                            <Text style={{ color: colors.mutedForeground, fontWeight: "700", textAlign: "center" }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.modalBtn, { flex: 1, backgroundColor: "#f97316" }]}
                            onPress={handleConfirmInvite}
                            disabled={inviting}
                          >
                            {inviting
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>
                                  Invite Karo
                                </Text>
                            }
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Members list — click accepted member for detail */}
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.foreground }]}>Members ({group?.members?.length ?? 0})</Text>
                    {(group?.members ?? []).length === 0 ? (
                      <Text style={[s.sub, { color: colors.mutedForeground }]}>No members yet</Text>
                    ) : (group?.members ?? []).map((m: any) => {
                      const stat = memberStats.find((s: any) => s.userId === m.userId);
                      const isAccepted = m.status === "accepted";
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[s.memberRow, { borderTopColor: colors.border }]}
                          onPress={() => isAccepted && openMemberDetail(m)}
                          activeOpacity={isAccepted ? 0.7 : 1}
                        >
                          {m.avatarUrl && !failedAvatars.has(m.userId) ? (
                            <Image
                              source={{ uri: m.avatarUrl.startsWith("http") ? m.avatarUrl : `${BASE_URL}${m.avatarUrl}` }}
                              style={{ width: 38, height: 38, borderRadius: 19 }}
                              onError={() => setFailedAvatars(prev => new Set([...prev, m.userId]))}
                            />
                          ) : (
                            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#f97316", alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{(m.name ?? "?")[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={[s.memberName, { color: colors.foreground }]}>{m.name}</Text>
                              {isAccepted && <Feather name="chevron-right" size={14} color={colors.mutedForeground} />}
                            </View>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              {isAccepted ? (
                                <>
                                  <Text style={[s.sub, { color: colors.mutedForeground }]}>Exams: {stat?.examsTaken ?? 0}</Text>
                                  <Text style={[s.sub, { color: colors.mutedForeground }]}>Spent: {formatCurrency(stat?.totalSpent)}</Text>
                                  <Text style={[s.sub, { color: "#f97316" }]}>Comm: {formatCurrency(stat?.commission)}</Text>
                                </>
                              ) : (
                                <Text style={[s.sub, { color: colors.mutedForeground }]}>Invited • Awaiting response</Text>
                              )}
                            </View>
                          </View>
                          <View style={[s.statusBadge, {
                            backgroundColor: m.status === "accepted" ? "#22c55e20" : m.status === "pending" ? "#f9731620" : "#ef444420"
                          }]}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: m.status === "accepted" ? "#22c55e" : m.status === "pending" ? "#f97316" : "#ef4444" }}>
                              {m.status}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
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
                    <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 14 }}>You are not a member of any group</Text>
                  </View>
                )
              )
            )}
          </ScrollView>
        </>
      )}

      {/* ── Rename Group Modal ── */}
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
                <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "center" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: "#f97316" }]} onPress={handleRename} disabled={renaming}>
                {renaming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Withdraw Commission Modal ── */}
      <Modal visible={showWithdraw} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Commission Withdraw</Text>
            <Text style={[s.sub, { color: colors.mutedForeground, marginBottom: 12 }]}>
              Available: {formatCurrency(group?.availableCommission)}
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={withdrawAmount} onChangeText={setWithdrawAmount}
              placeholder="Amount (₹)" placeholderTextColor={colors.mutedForeground} keyboardType="numeric"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, marginTop: 8 }]}
              value={withdrawUpi} onChangeText={setWithdrawUpi}
              placeholder="UPI ID (e.g. abc@upi)" placeholderTextColor={colors.mutedForeground} autoCapitalize="none"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: colors.muted }]} onPress={() => setShowWithdraw(false)}>
                <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "center" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: "#f97316" }]} onPress={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Member Detail Modal ── */}
      <Modal visible={!!selectedMember} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.detailModal, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: colors.foreground, marginBottom: 0 }]}>Member Profile</Text>
              <TouchableOpacity onPress={() => { setSelectedMember(null); setMemberDetail(null); }}
                style={{ padding: 4 }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={{ alignItems: "center", padding: 30 }}>
                <ActivityIndicator color="#f97316" size="large" />
                <Text style={[s.sub, { color: colors.mutedForeground, marginTop: 10 }]}>Loading...</Text>
              </View>
            ) : memberDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Member info */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  {memberDetail.member?.avatarUrl && !failedAvatars.has(memberDetail.member?.id) ? (
                    <Image
                      source={{ uri: memberDetail.member.avatarUrl.startsWith("http") ? memberDetail.member.avatarUrl : `${BASE_URL}${memberDetail.member.avatarUrl}` }}
                      style={{ width: 50, height: 50, borderRadius: 25 }}
                      onError={() => setFailedAvatars(prev => new Set([...prev, memberDetail.member?.id]))}
                    />
                  ) : (
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "#f97316", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>{(memberDetail.member?.name ?? "?")[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontWeight: "900", fontSize: 16, color: colors.foreground }]}>{memberDetail.member?.name}</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground }]}>{memberDetail.member?.email}</Text>
                    <Text style={[s.sub, { color: colors.mutedForeground }]}>Joined: {formatDate(memberDetail.joinedAt)}</Text>
                    <TouchableOpacity
                      onPress={() => { setSelectedMember(null); setMemberDetail(null); router.push(`/user/${memberDetail.member?.id}`); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
                    >
                      <Text style={{ color: "#f97316", fontSize: 12, fontWeight: "700" }}>View Full Profile</Text>
                      <Feather name="external-link" size={11} color="#f97316" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Stats */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  <View style={[s.statBox, { backgroundColor: "#eff6ff" }]}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: "#2563eb" }}>{memberDetail.stats?.examsTaken ?? 0}</Text>
                    <Text style={[s.sub, { color: "#2563eb" }]}>Exams</Text>
                  </View>
                  <View style={[s.statBox, { backgroundColor: "#ecfdf5" }]}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: "#059669" }}>{formatCurrency(memberDetail.stats?.totalSpent)}</Text>
                    <Text style={[s.sub, { color: "#059669" }]}>Spent</Text>
                  </View>
                  <View style={[s.statBox, { backgroundColor: "#fff7ed" }]}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: "#f97316" }}>{formatCurrency(memberDetail.stats?.commission)}</Text>
                    <Text style={[s.sub, { color: "#f97316" }]}>My Commission</Text>
                  </View>
                </View>

                {/* Exam history */}
                <Text style={[{ fontWeight: "800", fontSize: 14, color: colors.foreground, marginBottom: 8 }]}>
                  Exam History ({memberDetail.exams?.length ?? 0})
                </Text>
                {(memberDetail.exams ?? []).length === 0 ? (
                  <Text style={[s.sub, { color: colors.mutedForeground, textAlign: "center", padding: 16 }]}>No exams taken yet</Text>
                ) : (memberDetail.exams ?? []).map((e: any, i: number) => (
                  <View key={i} style={[s.examRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", fontSize: 13, color: colors.foreground }} numberOfLines={1}>{e.examTitle ?? "Exam"}</Text>
                      <Text style={[s.sub, { color: colors.mutedForeground }]}>{e.examCategory} • {formatDate(e.examStartTime)}</Text>
                      {e.submission && (
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 3 }}>
                          <Text style={[s.sub, { color: "#2563eb" }]}>Score: {e.submission.score}/{e.submission.totalQuestions}</Text>
                          {e.submission.rank && <Text style={[s.sub, { color: "#7c3aed" }]}>Rank: #{e.submission.rank}</Text>}
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontWeight: "700", fontSize: 13, color: "#22c55e" }}>₹{e.amountPaid}</Text>
                      {e.submission ? (
                        <View style={[s.statusBadge, { backgroundColor: "#ecfdf5" }]}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#059669" }}>Attempted</Text>
                        </View>
                      ) : (
                        <View style={[s.statusBadge, { backgroundColor: "#f9731620" }]}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#f97316" }}>Registered</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
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
  inviteBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  inviteBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  foundUserCard: { marginTop: 10, borderRadius: 12, borderWidth: 1.5, padding: 12 },
  foundAvatar: { width: 42, height: 42, borderRadius: 21 },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  memberName: { fontSize: 13, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inviteRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#f9731640" },
  inviteName: { fontSize: 13, fontWeight: "700" },
  inviteSub: { fontSize: 11, marginTop: 2 },
  inviteActions: { flexDirection: "row", gap: 6 },
  acceptBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modal: { borderRadius: 18, padding: 20 },
  detailModal: { borderRadius: 18, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 14 },
  modalBtn: { borderRadius: 10, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  examRow: { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
});
