import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
  ToastAndroid,
  Modal,
  Switch,
  Alert,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const SCREEN_WIDTH = Dimensions.get("window").width;
const POST_GRID_SIZE = (SCREEN_WIDTH - 32 - 8) / 3; // 3 cols, 16px margin each side, 4px gaps
const REEL_GRID_SIZE = (SCREEN_WIDTH - 32 - 6) / 2; // 2 cols
import * as Clipboard from "expo-clipboard";
import { showError, showConfirm } from "@/utils/alert";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useGetMe, useGetMyStats, customFetch } from "@workspace/api-client-react";
import { GuestScreen } from "@/components/GuestScreen";

// Returns how many more points are needed to reach the next tier
function getNextTierPts(pts: number): number {
  if (pts <= 100) return 101 - pts;
  if (pts <= 200) return 201 - pts;
  if (pts <= 400) return 401 - pts;
  if (pts <= 700) return 701 - pts;
  return 0; // Champion — already max
}

const CATEGORY_COLORS: Record<string, string> = {
  SSC: "#2563eb",
  UPSC: "#7c3aed",
  Banking: "#059669",
  Railways: "#dc2626",
  Defence: "#d97706",
};

export default function ProfileScreen() {
  const colors = useColors();
  const { resolvedTheme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, token } = useAuth();
  const queryClient = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uidCopied, setUidCopied] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<{ id: number; name: string; avatarUrl: string | null }[]>([]);
  const [myRoles, setMyRoles] = useState<string[]>([]);

  // Premium animations
  const premiumPulse = useRef(new Animated.Value(0)).current;
  const premiumSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(premiumPulse, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(premiumPulse, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(premiumSpin, { toValue: 1, duration: 4000, useNativeDriver: true })
    ).start();
  }, []);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  // Edit name
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  const openEditName = () => {
    setEditNameValue(user?.name ?? "");
    setEditNameVisible(true);
  };

  const saveEditName = async () => {
    const trimmed = editNameValue.trim();
    if (!trimmed) { showError("Invalid Name", "Name cannot be empty."); return; }
    if (trimmed.length < 2) { showError("Invalid Name", "Name must be at least 2 characters."); return; }
    setSavingName(true);
    try {
      const data = await customFetch<{ name: string }>("/api/users/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
        headers: { "Content-Type": "application/json" },
      });
      updateUser({ name: data.name });
      setEditNameVisible(false);
    } catch {
      showError("Save Failed", "Could not update your name. Please try again.");
    }
    setSavingName(false);
  };


  const ROLE_COLORS: Record<string, string> = {
    teacher: "#2563eb", influencer: "#7c3aed", promoter: "#d97706",
    partner: "#059669", premium: "#f97316", customer_support: "#0ea5e9",
  };
  const [loadingSettings, setLoadingSettings] = useState(false);

  const copyUID = useCallback(async () => {
    const uidNum = user?.customUid ?? user?.id ?? "";
    const uid = `UID-RY${String(uidNum).padStart(10, "0")}`;
    await Clipboard.setStringAsync(uid);
    setUidCopied(true);
    if (Platform.OS === "android") {
      ToastAndroid.show("UID copied!", ToastAndroid.SHORT);
    }
    setTimeout(() => setUidCopied(false), 2000);
  }, [user?.id]);

  const { data: meData, refetch: refetchMe } = useGetMe();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetMyStats();
  const { data: followCounts, refetch: refetchFollow } = useQuery({
    queryKey: ["user-follow-counts", user?.id],
    queryFn: async () => {
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${baseUrl}/api/users/${user?.id}/public-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      return { followersCount: d.followersCount ?? 0, followingCount: d.followingCount ?? 0 };
    },
    enabled: !!user?.id && !!token,
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      refetchMe();
      refetchStats();
      refetchFollow();
      if (token) {
        const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
        const h = { Authorization: `Bearer ${token}` };
        fetch(`${base}/api/roles/my`, { headers: h })
          .then(r => r.ok ? r.json() : []).then(setMyRoles).catch(() => {});
        fetch(`${base}/api/groups/pending-invites-count`, { headers: h })
          .then(r => r.ok ? r.json() : { count: 0 })
          .then(d => setPendingInvitesCount(d.count ?? 0)).catch(() => {});
      }
    }, [refetchMe, refetchStats, refetchFollow, token])
  );

  useEffect(() => {
    if (!meData) return;
    const d = meData as any;
    const updates: Record<string, any> = {};
    if (d.walletBalance !== undefined) updates.walletBalance = d.walletBalance;
    if (d.avatarUrl !== undefined) updates.avatarUrl = d.avatarUrl;
    if (d.phone !== undefined) updates.phone = d.phone;
    if (d.govtId !== undefined) updates.govtId = d.govtId;
    if (d.verificationStatus !== undefined) updates.verificationStatus = d.verificationStatus;
    if (Object.keys(updates).length > 0) updateUser(updates as any);
  }, [meData]);

  const openSettings = useCallback(async () => {
    setLoadingSettings(true);
    setSettingsVisible(true);
    try {
      const [onlineRes, blockedRes] = await Promise.all([
        customFetch<{ showOnlineStatus: boolean }>("/api/me/online-status"),
        customFetch<any[]>("/api/me/blocked-users"),
      ]);
      setShowOnlineStatus(onlineRes.showOnlineStatus);
      setBlockedUsers(blockedRes);
    } catch {}
    setLoadingSettings(false);
  }, []);

  const toggleOnlineStatus = async (val: boolean) => {
    setShowOnlineStatus(val);
    try { await customFetch("/api/me/online-status", { method: "PATCH", body: JSON.stringify({ showOnlineStatus: val }), headers: { "Content-Type": "application/json" } }); } catch {}
  };

  const handleUnblock = (uid: number, name: string) => {
    Alert.alert("Unblock User", `Unblock ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock", style: "destructive", onPress: async () => {
          try {
            await customFetch(`/api/users/${uid}/block`, { method: "DELETE" });
            setBlockedUsers((prev) => prev.filter((u) => u.id !== uid));
          } catch {}
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.flex, styles.guestCenter, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Image
          source={require("@/assets/images/full-logo.png")}
          style={styles.guestLogo}
          resizeMode="contain"
        />
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
          Sign in to view your profile, track performance, and compete for cash prizes.
        </Text>
        <TouchableOpacity
          style={[styles.guestBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Feather name="log-in" size={18} color={colors.primaryForeground} />
          <Text style={[styles.guestBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.guestBtnOutline, { borderColor: colors.primary }]}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Feather name="user-plus" size={18} color={colors.primary} />
          <Text style={[styles.guestBtnText, { color: colors.primary }]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getFullAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}${url}`;
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Needed", "Please allow photo access in your settings to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";

    if (!asset.base64) {
      showError("Upload Failed", "Could not read image. Please try again.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarBase64: asset.base64, mimeType }),
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      updateUser({ avatarUrl: data.avatarUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showError("Upload Failed", "Failed to upload profile photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    showConfirm(
      "Sign Out",
      "Are you sure you want to sign out of your account?",
      async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await logout();
        queryClient.clear();
        router.replace("/(tabs)/");
      },
      "Sign Out",
      "Cancel",
      "warning"
    );
  };

  const initials = (user?.name ?? "A")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Tier colors matching points-based badge system
  const skillColor =
    stats?.skillLevel === "Champion" ? "#f59e0b" :
    stats?.skillLevel === "Advanced"  ? "#ef4444" :
    stats?.skillLevel === "Warrior"   ? "#8b5cf6" :
    stats?.skillLevel === "Explorer"  ? "#0891b2" :
    "#6b7280"; // Beginner = grey

  const isKycVerified = (user as any)?.verificationStatus === "verified";
  const isPremium = myRoles.includes("premium");
  const premiumRingBorderColor = premiumPulse.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["#f59e0b", "#fbbf24", "#f97316", "#fbbf24", "#f59e0b"],
  });
  const premiumStarRotate = premiumSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (!user) return (
    <GuestScreen
      icon="user"
      title="Your Profile"
      subtitle="Sign in to view your stats, follow others, and manage your account"
    />
  );

  return (
    <>
      {/* ─── Edit Name Modal ─── */}
      <Modal visible={editNameVisible} transparent animationType="fade" onRequestClose={() => setEditNameVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000066" }} activeOpacity={1} onPress={() => !savingName && setEditNameVisible(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 24 }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                <Feather name="user" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Edit Name</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>This is how other users see you</Text>
              </View>
            </View>
            <TextInput
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontSize: 16,
                color: colors.foreground,
                marginBottom: 16,
              }}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Enter your full name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={saveEditName}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setEditNameVisible(false)}
                disabled={savingName}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEditName}
                disabled={savingName || !editNameValue.trim()}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: editNameValue.trim() ? colors.primary : colors.muted, alignItems: "center" }}
              >
                {savingName
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 15, fontWeight: "700", color: editNameValue.trim() ? "#fff" : colors.mutedForeground }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsVisible(false)}>
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.settingsHeader, { paddingTop: insets.top + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.settingsTitle, { color: colors.foreground }]}>Settings</Text>
            <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {loadingSettings ? (
            <View style={[styles.flex, { alignItems: "center", justifyContent: "center" }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
              {/* Online Status */}
              <View style={[styles.settingsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.settingsSectionTitle, { color: colors.mutedForeground }]}>Privacy</Text>
                <View style={styles.settingsRow}>
                  <View style={styles.settingsRowLeft}>
                    <View style={[styles.settingsIcon, { backgroundColor: "#22c55e20" }]}>
                      <Feather name="radio" size={16} color="#22c55e" />
                    </View>
                    <View>
                      <Text style={[styles.settingsRowLabel, { color: colors.foreground }]}>Show Online Status</Text>
                      <Text style={[styles.settingsRowSub, { color: colors.mutedForeground }]}>
                        Let others see when you're online
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={showOnlineStatus}
                    onValueChange={toggleOnlineStatus}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {/* Blocked Users */}
              <View style={{ marginTop: 20, marginHorizontal: 16 }}>
                <Text style={[styles.settingsSectionTitle, { color: colors.mutedForeground, marginBottom: 10 }]}>
                  Blocked Users ({blockedUsers.length})
                </Text>
                {blockedUsers.length === 0 ? (
                  <View style={[styles.emptyBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="user-check" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyBlockText, { color: colors.mutedForeground }]}>No blocked users</Text>
                  </View>
                ) : (
                  blockedUsers.map((u) => (
                    <View key={u.id} style={[styles.blockedUserRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {u.avatarUrl ? (
                        <Image source={{ uri: u.avatarUrl }} style={styles.blockedAvatar} />
                      ) : (
                        <View style={[styles.blockedAvatar, styles.blockedAvatarFallback, { backgroundColor: colors.primary + "20" }]}>
                          <Text style={[styles.blockedAvatarText, { color: colors.primary }]}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.blockedName, { color: colors.foreground }]} numberOfLines={1}>{u.name}</Text>
                      <TouchableOpacity
                        onPress={() => handleUnblock(u.id, u.name)}
                        style={[styles.unblockBtn, { borderColor: colors.primary }]}
                      >
                        <Text style={[styles.unblockBtnText, { color: colors.primary }]}>Unblock</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Profile</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              onPress={() => { router.push("/(tabs)/support" as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.themeToggle, { backgroundColor: "#f9731618", borderColor: "#f9731640" }]}
            >
              <Feather name="headphones" size={17} color="#f97316" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { router.push("/groups-explore" as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.themeToggle, {
                backgroundColor: pendingInvitesCount > 0 ? "#f9731620" : myRoles.length > 0 ? (ROLE_COLORS[myRoles[0]] ?? "#f97316") + "20" : colors.card,
                borderColor: pendingInvitesCount > 0 ? "#f97316" : myRoles.length > 0 ? (ROLE_COLORS[myRoles[0]] ?? "#f97316") : colors.border,
              }]}
            >
              <Feather name="users" size={17} color={pendingInvitesCount > 0 ? "#f97316" : myRoles.length > 0 ? (ROLE_COLORS[myRoles[0]] ?? "#f97316") : colors.foreground} />
              {pendingInvitesCount > 0 && (
                <View style={{
                  position: "absolute", top: -4, right: -4,
                  backgroundColor: "#ef4444", borderRadius: 8, minWidth: 16, height: 16,
                  alignItems: "center", justifyContent: "center", paddingHorizontal: 2,
                }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{pendingInvitesCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { openSettings(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="settings" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { toggleTheme(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather
                name={resolvedTheme === "dark" ? "sun" : "moon"}
                size={18}
                color={resolvedTheme === "dark" ? colors.saffron : colors.indigo}
              />
            </TouchableOpacity>
          </View>
        </View>

      {/* Avatar + Name — tap to go to public profile */}
      <View style={{ marginHorizontal: 20, borderRadius: 20, marginBottom: 20 }}>
        {isPremium && (
          <Animated.View style={{
            position: "absolute", top: -2.5, left: -2.5, right: -2.5, bottom: -2.5,
            borderRadius: 22.5, borderWidth: 2.5,
            borderColor: premiumRingBorderColor,
          }} />
        )}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => { if (user?.id) router.push(`/user/${user.id}` as any); }}
        style={[styles.heroCard, { backgroundColor: colors.secondary, marginHorizontal: 0, marginBottom: 0 }]}
      >
        {isPremium && (
          <LinearGradient
            colors={["#0f0a1e", "#1a0a2e", "#2d1259", "#4c1d95"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        )}
        {/* Avatar wrapper with optional premium ring */}
        {isPremium ? (
          <View style={{ position: "relative" }}>
            <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrapper}>
              {getFullAvatarUrl(user?.avatarUrl) ? (
                <Image source={{ uri: getFullAvatarUrl(user?.avatarUrl)! }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: "#ffffff22" }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploadingAvatar ? <ActivityIndicator size={10} color="#fff" /> : <Feather name="camera" size={10} color="#fff" />}
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrapper}>
            {getFullAvatarUrl(user?.avatarUrl) ? (
              <Image
                source={{ uri: getFullAvatarUrl(user?.avatarUrl)! }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: "#ffffff22" }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size={10} color="#fff" />
              ) : (
                <Feather name="camera" size={10} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.heroInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={styles.heroName}>{user?.name}</Text>
            {isPremium && (
              <LinearGradient
                colors={["#f59e0b", "#f97316"]}
                style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>✦ PREMIUM</Text>
              </LinearGradient>
            )}
          </View>
          <Text style={styles.heroEmail}>{user?.email}</Text>
          {user?.id && (
            <TouchableOpacity
              onPress={copyUID}
              activeOpacity={0.75}
              style={[styles.uidChip, isPremium && { borderColor: "#f59e0b80", backgroundColor: "#f59e0b18" }]}
            >
              {isPremium && (
                <Animated.Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "800", transform: [{ rotate: premiumStarRotate }] }}>✦</Animated.Text>
              )}
              <Text style={[styles.uidChipText, isPremium && { color: "#f59e0b" }]}>
                UID-RY{String(user.customUid ?? user.id).padStart(10, "0")}
              </Text>
              <Feather
                name={uidCopied ? "check" : "copy"}
                size={11}
                color={uidCopied ? "#4ade80" : isPremium ? "#f59e0b99" : "#ffffff99"}
              />
            </TouchableOpacity>
          )}
          <View style={styles.heroRow}>
            {user?.isAdmin && (
              <View style={[styles.badge, { backgroundColor: colors.saffron }]}>
                <Text style={[styles.badgeText, { color: "#fff" }]}>👑 Admin</Text>
              </View>
            )}
            {isKycVerified && (
              <View style={[styles.badge, { backgroundColor: "#059669" }]}>
                <Feather name="shield" size={10} color="#fff" />
                <Text style={[styles.badgeText, { color: "#fff", marginLeft: 3 }]}>KYC Verified</Text>
              </View>
            )}
            {stats && (
              <View style={[styles.badge, { backgroundColor: skillColor }]}>
                <Text style={[styles.badgeText, { color: "#fff" }]}>
                  {stats.skillIcon} {stats.skillLevel}
                </Text>
              </View>
            )}
            {!!(user as any)?.userRole && (user as any)?.userRole !== "premium" && (
              <View style={[styles.badge, { backgroundColor: "#7c3aed" }]}>
                <Text style={[styles.badgeText, { color: "#fff" }]}>🎓 {(user as any).userRole}</Text>
              </View>
            )}
            {!!(user as any)?.groupBadge && (
              <View style={[styles.badge, { backgroundColor: "#0369a1" }]}>
                <Text style={[styles.badgeText, { color: "#fff" }]}>👥 {(user as any).groupBadge}</Text>
              </View>
            )}
          </View>
          {stats && (() => {
            const pts = (stats as any).rankPoints ?? stats.totalCorrect ?? 0;
            const toNext = getNextTierPts(pts);
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                <Feather name="zap" size={10} color="#ffffff88" />
                <Text style={{ fontSize: 11, color: "#ffffff88", fontWeight: "600" }}>{pts} pts</Text>
                {toNext > 0
                  ? <Text style={{ fontSize: 10, color: "#ffffff55" }}>· {toNext} pts to next tier</Text>
                  : <Text style={{ fontSize: 10, color: "#f59e0b" }}>· Max Tier 🏆</Text>
                }
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); if (user?.id) router.push(`/user/${user.id}` as any); }}
                  style={{ marginLeft: 4, backgroundColor: "#ffffff22", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>View Profile →</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
      </View>

      {/* Followers / Following Row */}
      {user?.id && (
        <View style={styles.followRow}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.followCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/user-followers/${user.id}` as any); }}
          >
            <View style={[styles.followIconBox, { backgroundColor: "#8b5cf618" }]}>
              <Feather name="users" size={15} color="#8b5cf6" />
            </View>
            <Text style={[styles.followCount, { color: "#8b5cf6" }]}>{followCounts?.followersCount ?? 0}</Text>
            <Text style={[styles.followLabel, { color: colors.mutedForeground }]}>Followers</Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.followCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/user-following/${user.id}` as any); }}
          >
            <View style={[styles.followIconBox, { backgroundColor: "#0891b218" }]}>
              <Feather name="user-check" size={15} color="#0891b2" />
            </View>
            <Text style={[styles.followCount, { color: "#0891b2" }]}>{followCounts?.followingCount ?? 0}</Text>
            <Text style={[styles.followLabel, { color: colors.mutedForeground }]}>Following</Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Wallet Banner — tappable */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push("/(tabs)/wallet")}
        style={[styles.walletBanner, { backgroundColor: colors.secondary, marginHorizontal: 16, marginBottom: 16 }]}
      >
        <View style={styles.walletBannerLeft}>
          <View style={[styles.walletBannerIcon, { backgroundColor: "#ffffff18" }]}>
            <Feather name="credit-card" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.walletBannerLabel}>Wallet Balance</Text>
            <Text style={styles.walletBannerAmount}>
              ₹{Number(user?.walletBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
        <View style={styles.walletBannerActions}>
          <TouchableOpacity
            style={[styles.walletBannerBtn, { backgroundColor: colors.primary }]}
            onPress={(e) => { e.stopPropagation(); router.push("/wallet/deposit"); }}
          >
            <Feather name="plus" size={13} color={colors.primaryForeground} />
            <Text style={[styles.walletBannerBtnText, { color: colors.primaryForeground }]}>Add Money</Text>
          </TouchableOpacity>
          {isKycVerified ? (
            <TouchableOpacity
              style={[styles.walletBannerBtn, { backgroundColor: "#ffffff1a" }]}
              onPress={(e) => { e.stopPropagation(); router.push("/wallet/withdraw"); }}
            >
              <Feather name="arrow-up" size={13} color="#fff" />
              <Text style={[styles.walletBannerBtnText, { color: "#fff" }]}>Withdraw</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.walletBannerBtn, { backgroundColor: "#ef444433" }]}
              onPress={(e) => { e.stopPropagation(); router.push("/verify"); }}
            >
              <Feather name="lock" size={13} color="#fca5a5" />
              <Text style={[styles.walletBannerBtnText, { color: "#fca5a5" }]}>Verify to Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>


      {/* Refer & Earn Card */}
      <TouchableOpacity
        style={[styles.referEarnCard, { marginHorizontal: 16, marginBottom: 14 }]}
        onPress={() => router.push("/referral" as any)}
        activeOpacity={0.85}
      >
        <View style={styles.referEarnIcon}>
          <Feather name="gift" size={24} color="#fff" />
        </View>
        <View style={styles.referEarnContent}>
          <Text style={styles.referEarnTitle}>Refer & Earn ₹20!</Text>
          <Text style={styles.referEarnSubtitle}>Refer a friend — both of you get ₹20 bonus 🎉</Text>
        </View>
        <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Performance Dashboard */}
      <SectionHeader title="Performance Dashboard" icon="bar-chart-2" colors={colors} />
      <View style={[styles.perfCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Quick Stats inside dashboard */}
        <View style={[styles.perfRow, { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <PerfStat label="Participated" value={stats?.examsParticipated ?? 0} icon="book-open" color={colors.primary} colors={colors} />
          <PerfStat label="Completed" value={stats?.examsCompleted ?? 0} icon="check-circle" color="#059669" colors={colors} />
          <PerfStat label="Won" value={stats?.examsWon ?? 0} icon="award" color="#f59e0b" colors={colors} />
        </View>
        <View style={styles.perfRow}>
          <PerfStat label="Accuracy" value={`${stats?.accuracyPercent ?? 0}%`} icon="target" color="#6366f1" colors={colors} />
          <PerfStat label="Avg Score" value={`${stats?.avgScore ?? 0}%`} icon="trending-up" color="#0891b2" colors={colors} />
          <PerfStat label="Best Rank" value={stats?.highestRank ? `#${stats.highestRank}` : "—"} icon="star" color="#f59e0b" colors={colors} />
          <PerfStat label="Podium" value={`${stats?.podiumFinishes ?? 0}x`} icon="zap" color="#ef4444" colors={colors} />
        </View>

        {/* Accuracy bar */}
        {!statsLoading && (stats?.examsCompleted ?? 0) > 0 && (
          <View style={styles.accSection}>
            <View style={styles.accLabelRow}>
              <Text style={[styles.accLabel, { color: colors.mutedForeground }]}>Overall Accuracy</Text>
              <Text style={[styles.accValue, { color: colors.foreground }]}>{stats?.accuracyPercent}%</Text>
            </View>
            <View style={[styles.accBarBg, { backgroundColor: colors.muted }]}>
              <View
                style={[styles.accBarFill, {
                  width: `${stats?.accuracyPercent ?? 0}%` as any,
                  backgroundColor: (stats?.accuracyPercent ?? 0) >= 70 ? "#059669" : (stats?.accuracyPercent ?? 0) >= 50 ? "#f59e0b" : "#ef4444"
                }]}
              />
            </View>

            <View style={styles.accLabelRow}>
              <Text style={[styles.accLabel, { color: colors.mutedForeground }]}>Avg Time per Exam</Text>
              <Text style={[styles.accValue, { color: colors.foreground }]}>{formatTime(stats?.avgTimeTakenSeconds ?? 0)}</Text>
            </View>
            <View style={styles.accLabelRow}>
              <Text style={[styles.accLabel, { color: colors.mutedForeground }]}>Total Winnings</Text>
              <Text style={[styles.accValue, { color: "#059669", fontWeight: "700" }]}>₹{Number(stats?.totalWinnings ?? 0).toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.accLabelRow}>
              <Text style={[styles.accLabel, { color: colors.mutedForeground }]}>Questions Attempted</Text>
              <Text style={[styles.accValue, { color: colors.foreground }]}>{stats?.totalCorrect ?? 0} / {stats?.totalQuestions ?? 0}</Text>
            </View>
          </View>
        )}

        {statsLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        )}

        {!statsLoading && (stats?.examsCompleted ?? 0) === 0 && (
          <View style={styles.emptyPerf}>
            <Feather name="activity" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyPerfText, { color: colors.mutedForeground }]}>
              Participate in exams to see your performance stats
            </Text>
          </View>
        )}
      </View>

      {/* Knowledge Skill Predictor */}
      {(stats?.categoryBreakdown?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Knowledge Skill Predictor" icon="zap" colors={colors} />
          <View style={[styles.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.catSubtitle, { color: colors.mutedForeground }]}>
              Your strongest subjects based on exam performance
            </Text>
            {stats?.categoryBreakdown.map((cat) => {
              const catColor = CATEGORY_COLORS[cat.category] ?? colors.secondary;
              return (
                <View key={cat.category} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  <Text style={[styles.catName, { color: colors.foreground }]}>{cat.category}</Text>
                  <Text style={[styles.catExams, { color: colors.mutedForeground }]}>{cat.count} exam{cat.count !== 1 ? "s" : ""}</Text>
                  <View style={styles.catBarWrap}>
                    <View style={[styles.catBarBg, { backgroundColor: colors.muted }]}>
                      <View style={[styles.catBarFill, { width: `${cat.accuracy}%` as any, backgroundColor: catColor }]} />
                    </View>
                    <Text style={[styles.catPct, { color: catColor }]}>{cat.accuracy}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Recent Results */}
      {(stats?.recentResults?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Recent Results" icon="clock" colors={colors} />
          <View style={styles.recentList}>
            {stats?.recentResults.map((r, i) => {
              const catColor = CATEGORY_COLORS[r.category] ?? colors.secondary;
              const pct = r.totalQuestions > 0 ? Math.round((r.correctAnswers / r.totalQuestions) * 100) : 0;
              return (
                <View key={i} style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.resultLeft, { backgroundColor: catColor + "15" }]}>
                    <Text style={[styles.resultRank, { color: catColor }]}>
                      {r.rank ? `#${r.rank}` : "—"}
                    </Text>
                    <Text style={[styles.resultRankLabel, { color: catColor + "99" }]}>rank</Text>
                  </View>
                  <View style={styles.resultMid}>
                    <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {r.examTitle}
                    </Text>
                    <View style={styles.resultMeta}>
                      <View style={[styles.catPill, { backgroundColor: catColor + "20" }]}>
                        <Text style={[styles.catPillText, { color: catColor }]}>{r.category}</Text>
                      </View>
                      <Text style={[styles.resultTime, { color: colors.mutedForeground }]}>
                        {formatTime(r.timeTakenSeconds)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.resultRight}>
                    <Text style={[styles.resultScore, { color: pct >= 70 ? "#059669" : pct >= 50 ? "#f59e0b" : "#ef4444" }]}>
                      {pct}%
                    </Text>
                    <Text style={[styles.resultCorrect, { color: colors.mutedForeground }]}>
                      {r.correctAnswers}/{r.totalQuestions}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}


      {/* My Account */}
      <SectionHeader title="My Account" icon="user" colors={colors} />
      <AccountSection
        user={user}
        colors={colors}
        onVerifyPress={() => router.push("/verify")}
        onChangeCredentials={() => router.push("/change-credentials")}
        onPreferences={() => router.push("/exam-preferences")}
        onEditName={openEditName}
      />

      {/* App */}
      <SectionHeader title="App" icon="star" colors={colors} />
      <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Linking.openURL("https://play.google.com/store/games?hl=en_IN")}>
          <View style={[styles.menuIconBox, { backgroundColor: "#2563eb18" }]}>
            <Feather name="star" size={15} color="#2563eb" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Rate us on Play Store</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Linking.openURL("https://instagram.com/rankyatraapp")}>
          <View style={[styles.menuIconBox, { backgroundColor: "#e1306c18" }]}>
            <Feather name="instagram" size={15} color="#e1306c" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Follow on Instagram</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Linking.openURL("https://facebook.com/rankyatraapp")}>
          <View style={[styles.menuIconBox, { backgroundColor: "#1877f218" }]}>
            <Feather name="facebook" size={15} color="#1877f2" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Follow on Facebook</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Linking.openURL("https://x.com/rankyatraapp")}>
          <View style={[styles.menuIconBox, { backgroundColor: colors.foreground + "15" }]}>
            <Text style={{ fontSize: 13, fontWeight: "900", color: colors.foreground }}>𝕏</Text>
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Follow on X</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Linking.openURL("https://youtube.com/@rankyatraapp")}>
          <View style={[styles.menuIconBox, { backgroundColor: "#ff000015" }]}>
            <Feather name="youtube" size={15} color="#ff0000" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Subscribe on YouTube</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Support */}
      <SectionHeader title="Support" icon="help-circle" colors={colors} />
      <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push("/(tabs)/support" as any)}>
          <View style={[styles.menuIconBox, { backgroundColor: "#f9731618" }]}>
            <Feather name="headphones" size={15} color="#f97316" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Customer Support</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push("/faq" as any)}>
          <View style={[styles.menuIconBox, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="help-circle" size={15} color={colors.primary} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Help & FAQ</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push("/terms" as any)}>
          <View style={[styles.menuIconBox, { backgroundColor: "#7c3aed18" }]}>
            <Feather name="file-text" size={15} color="#7c3aed" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Terms & Conditions</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push("/privacy" as any)}>
          <View style={[styles.menuIconBox, { backgroundColor: "#05966918" }]}>
            <Feather name="shield" size={15} color="#059669" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Privacy Policy</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { marginTop: 8 }]}>
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </>
  );
}

const VERIFY_STATUS: Record<string, { label: string; icon: string; color: string }> = {
  not_submitted: { label: "Need Verify", icon: "alert-circle", color: "#ef4444" },
  under_review:  { label: "Under Review", icon: "clock",        color: "#f59e0b" },
  verified:      { label: "Verified",      icon: "check-circle", color: "#059669" },
  rejected:      { label: "Rejected",      icon: "x-circle",     color: "#dc2626" },
};

function AccountSection({ user, colors, onVerifyPress, onChangeCredentials, onPreferences, onEditName }: {
  user: any; colors: any; onVerifyPress: () => void; onChangeCredentials: () => void; onPreferences: () => void; onEditName: () => void;
}) {
  const vs = VERIFY_STATUS[user?.verificationStatus ?? "not_submitted"] ?? VERIFY_STATUS.not_submitted;

  const staticRows = [
    { icon: "phone",       iconBg: "#7c3aed18", iconColor: "#7c3aed", label: "Phone Number", value: user?.phone ?? "Not added" },
    { icon: "mail",        iconBg: "#0891b218",  iconColor: "#0891b2", label: "Email ID",     value: user?.email ?? "—" },
    { icon: "credit-card", iconBg: "#d9770618",  iconColor: "#d97706", label: "Govt ID",      value: user?.govtId ?? "Not added" },
  ];

  return (
    <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Name row — tappable to edit */}
      <TouchableOpacity style={styles.menuItem} onPress={onEditName} activeOpacity={0.7}>
        <View style={[styles.menuIconBox, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="user" size={15} color={colors.primary} />
        </View>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>Name</Text>
        <Text style={[styles.menuValue, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>{user?.name ?? "—"}</Text>
        <Feather name="edit-2" size={14} color={colors.primary} />
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {staticRows.map((row) => (
        <React.Fragment key={row.label}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIconBox, { backgroundColor: row.iconBg }]}>
              <Feather name={row.icon as any} size={15} color={row.iconColor} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>{row.label}</Text>
            <Text style={[styles.menuValue, { color: colors.mutedForeground }]} numberOfLines={1}>{row.value}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </React.Fragment>
      ))}

      {/* Profile Status — tappable */}
      <TouchableOpacity style={styles.menuItem} onPress={onVerifyPress} activeOpacity={0.7}>
        <View style={[styles.menuIconBox, { backgroundColor: vs.color + "18" }]}>
          <Feather name={vs.icon as any} size={15} color={vs.color} />
        </View>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>Profile Status</Text>
        <View style={[styles.verifyBadge, { backgroundColor: vs.color + "18" }]}>
          <Feather name={vs.icon as any} size={12} color={vs.color} />
          <Text style={[styles.verifyText, { color: vs.color }]}>{vs.label}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Change Email & Mobile */}
      <TouchableOpacity style={styles.menuItem} onPress={onChangeCredentials} activeOpacity={0.7}>
        <View style={[styles.menuIconBox, { backgroundColor: "#0284c718" }]}>
          <Feather name="refresh-cw" size={15} color="#0284c7" />
        </View>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>Change Email & Mobile</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Exam Preferences */}
      <TouchableOpacity style={styles.menuItem} onPress={onPreferences} activeOpacity={0.7}>
        <View style={[styles.menuIconBox, { backgroundColor: "#7c3aed18" }]}>
          <Feather name="sliders" size={15} color="#7c3aed" />
        </View>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>Exam Preferences</Text>
        {user?.preferences?.length > 0 && (
          <View style={[styles.verifyBadge, { backgroundColor: "#7c3aed18" }]}>
            <Text style={{ color: "#7c3aed", fontSize: 12, fontWeight: "700" }}>
              {user.preferences.length} selected
            </Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({ title, icon, colors }: { title: string; icon: any; colors: any }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

function StatCard({ icon, label, value, color, colors, loading }: {
  icon: any; label: string; value: number | string; color: string; colors: any; loading: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={color} style={{ marginTop: 4 }} />
      ) : (
        <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
      )}
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function PerfStat({ label, value, icon, color, colors }: {
  label: string; value: string; icon: any; color: string; colors: any;
}) {
  return (
    <View style={styles.perfStat}>
      <View style={[styles.perfIconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.perfValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.perfLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, value, colors }: { icon: any; label: string; value?: string; colors: any }) {
  return (
    <View style={styles.menuItem}>
      <Feather name={icon} size={18} color={colors.mutedForeground} />
      <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
      {value && (
        <Text style={[styles.menuValue, { color: colors.mutedForeground }]} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Profile content tab bar
  profileTabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  profileTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  profileTabLabel: { fontSize: 13 },
  // Post grid
  postGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  postGridItem: {
    width: POST_GRID_SIZE,
    height: POST_GRID_SIZE,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  postGridImage: { width: "100%", height: "100%", resizeMode: "cover" },
  postGridTextBox: {
    flex: 1,
    padding: 8,
    justifyContent: "center",
  },
  postGridText: { fontSize: 11, lineHeight: 15 },
  postGridStats: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#00000055",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  postGridStatText: { fontSize: 9, color: "#fff" },
  // Reel grid
  reelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reelGridItem: {
    width: REEL_GRID_SIZE,
    height: REEL_GRID_SIZE * 1.4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  reelGridImage: { width: "100%", height: "100%", resizeMode: "cover" },
  reelGridPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reelPlayOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
  },
  reelViewsRow: {
    position: "absolute",
    bottom: 28,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#00000055",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  reelViewsText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  reelCaption: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    fontSize: 10,
    backgroundColor: "#00000055",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    color: "#fff",
  },
  // Tab empty state
  tabEmpty: {
    alignItems: "center",
    marginTop: 60,
    gap: 10,
  },
  tabEmptyTitle: { fontSize: 16, fontWeight: "700" },
  tabEmptyText: { fontSize: 13, textAlign: "center" },
  // Settings modal styles
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  settingsTitle: { fontSize: 20, fontWeight: "800" },
  closeBtn: { padding: 6 },
  settingsSection: { marginHorizontal: 16, marginTop: 20, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  settingsSectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, textTransform: "uppercase" },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  settingsRowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingsIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingsRowLabel: { fontSize: 15, fontWeight: "600" },
  settingsRowSub: { fontSize: 12, marginTop: 2 },
  emptyBlock: { borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingVertical: 30, gap: 8 },
  emptyBlockText: { fontSize: 14 },
  blockedUserRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8, gap: 12 },
  blockedAvatar: { width: 42, height: 42, borderRadius: 21 },
  blockedAvatarFallback: { alignItems: "center", justifyContent: "center" },
  blockedAvatarText: { fontSize: 14, fontWeight: "700" },
  blockedName: { flex: 1, fontSize: 15, fontWeight: "600" },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5 },
  unblockBtnText: { fontSize: 13, fontWeight: "700" },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  themeToggle: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },

  // Refer & Earn card
  referEarnCard: {
    borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#f97316",
  },
  referEarnIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  referEarnContent: { flex: 1 },
  referEarnTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  referEarnSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },

  // Wallet banner
  walletBanner: { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  walletBannerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  walletBannerLabel: { color: "#ffffff99", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  walletBannerAmount: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 1 },
  walletBannerActions: { gap: 7 },
  walletBannerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  walletBannerBtnText: { fontSize: 12, fontWeight: "700" },

  // Hero card
  heroCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  avatarWrapper: {
    position: "relative",
    width: 70,
    height: 70,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3730a3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff33",
  },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  heroInfo: { flex: 1, gap: 3 },
  heroName: { color: "#fff", fontSize: 20, fontWeight: "800" },
  heroEmail: { color: "#ffffff99", fontSize: 12 },
  uidChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#f97316", borderWidth: 0,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 4,
  },
  uidChipText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, fontFamily: "monospace" },
  heroRow: { flexDirection: "row", gap: 5, flexWrap: "nowrap", marginTop: 4, alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, flexShrink: 1, flexDirection: "row", alignItems: "center" },
  badgeText: { fontSize: 10, fontWeight: "700", flexShrink: 1 },
  nameInput: {
    fontSize: 18,
    fontWeight: "700",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: "21%",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  statIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  statLabel: { fontSize: 10, fontWeight: "500", textAlign: "center" },

  followRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  followCard: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  followIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  followCount: { fontSize: 18, fontWeight: "900" },
  followLabel: { fontSize: 12, fontWeight: "500", flex: 1 },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800" },

  // Performance card
  perfCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  perfRow: { flexDirection: "row", justifyContent: "space-around" },
  perfStat: { alignItems: "center", gap: 4 },
  perfIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  perfValue: { fontSize: 16, fontWeight: "800" },
  perfLabel: { fontSize: 10, fontWeight: "500" },
  accSection: { gap: 8, marginTop: 4 },
  accLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accLabel: { fontSize: 13 },
  accValue: { fontSize: 13, fontWeight: "600" },
  accBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  accBarFill: { height: 8, borderRadius: 4 },
  center: { alignItems: "center", paddingVertical: 12 },
  emptyPerf: { alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyPerfText: { fontSize: 13, textAlign: "center" },

  // Category skill
  catCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  catSubtitle: { fontSize: 12, marginBottom: 4 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 13, fontWeight: "600", width: 60 },
  catExams: { fontSize: 11, width: 48 },
  catBarWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  catBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  catBarFill: { height: 6, borderRadius: 3 },
  catPct: { fontSize: 11, fontWeight: "700", width: 32, textAlign: "right" },

  // Recent results
  recentList: { paddingHorizontal: 20, gap: 10 },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  resultLeft: { padding: 14, alignItems: "center", justifyContent: "center", minWidth: 56 },
  resultRank: { fontSize: 16, fontWeight: "900" },
  resultRankLabel: { fontSize: 9, fontWeight: "600", marginTop: 1 },
  resultMid: { flex: 1, padding: 12, gap: 4 },
  resultTitle: { fontSize: 13, fontWeight: "700" },
  resultMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  catPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  catPillText: { fontSize: 10, fontWeight: "700" },
  resultTime: { fontSize: 11 },
  resultRight: { padding: 14, alignItems: "flex-end", justifyContent: "center" },
  resultScore: { fontSize: 18, fontWeight: "900" },
  resultCorrect: { fontSize: 10, marginTop: 2 },

  // Account
  section: { paddingHorizontal: 20, marginBottom: 16 },
  menuCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  menuValue: { fontSize: 13, maxWidth: 160 },
  menuIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  verifyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  verifyText: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, marginHorizontal: 16 },
  inlineEditRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  inlineInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14 },
  menuValueRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 160 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    marginTop: 20,
  },
  logoutText: { fontSize: 16, fontWeight: "700" },
  guestCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  guestLogo: { width: 200, height: 200, marginBottom: 8 },
  guestSub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    width: "100%",
    justifyContent: "center",
  },
  guestBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    width: "100%",
    justifyContent: "center",
  },
  guestBtnText: { fontSize: 15, fontWeight: "700" },
});
