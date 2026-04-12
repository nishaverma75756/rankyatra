import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/alert";
import { customFetch } from "@workspace/api-client-react";

interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
  isReferred: boolean;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  totalClicks: number;
}

interface ReferralEntry {
  id: number;
  name: string;
  status: "completed" | "pending" | "blocked";
  joinedAt: string;
}

export default function ReferralScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [applying, setApplying] = useState(false);
  const deviceFp = useRef<string>("");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  useEffect(() => {
    const initFp = async () => {
      const FP_KEY = "ry_device_fp";
      let fp = await AsyncStorage.getItem(FP_KEY);
      if (!fp) {
        fp = "mobile_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await AsyncStorage.setItem(FP_KEY, fp);
      }
      deviceFp.current = fp;
    };
    initFp();
  }, []);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [s, l] = await Promise.all([
        customFetch<ReferralStats>("/api/referral/stats"),
        customFetch<ReferralEntry[]>("/api/referral/list"),
      ]);
      setStats(s as any);
      setReferrals(Array.isArray(l) ? l as any[] : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [token]);

  const handleCopy = async () => {
    if (!stats?.referralLink) return;
    await Clipboard.setStringAsync(stats.referralLink);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!stats?.referralLink) return;
    try {
      await Share.share({
        message: `Join RankYatra and get ₹20 bonus!\n\nMy referral link: ${stats.referralLink}`,
        title: "RankYatra — Refer & Earn",
      });
    } catch {}
  };

  const handleApplyCode = async () => {
    if (!manualCode.trim()) return;
    setApplying(true);
    try {
      const data = await customFetch<any>("/api/referral/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: manualCode.trim().toUpperCase(), deviceFingerprint: deviceFp.current }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess("Code Applied!", data?.message ?? (data?.bonusCredited ? "₹20 added to your wallet!" : "Referral code applied."));
      setManualCode("");
      setLoading(true);
      fetchData();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("Could Not Apply", e?.response?.data?.error ?? e?.message ?? "Please check the code and try again.");
    } finally {
      setApplying(false);
    }
  };

  const c = colors;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Refer & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIcon}>
            <Feather name="gift" size={28} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Both get ₹20!</Text>
          <Text style={styles.heroSubtitle}>Refer a friend — ₹20 bonus is automatically credited to both wallets</Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✅ You get ₹20</Text></View>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✅ Friend gets ₹20</Text></View>
          </View>
        </View>

        {/* Referral Link Card */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Your Referral Link</Text>
          {loading ? (
            <View style={[styles.linkBox, { backgroundColor: c.muted }]}>
              <ActivityIndicator size="small" color={c.primary} />
            </View>
          ) : (
            <>
              <View style={[styles.linkBox, { backgroundColor: c.muted }]}>
                <Feather name="link" size={14} color={c.primary} />
                <Text style={[styles.linkText, { color: c.primary }]} numberOfLines={1}>{stats?.referralLink ?? "—"}</Text>
                <View style={[styles.codeBadge, { backgroundColor: c.primary + "20" }]}>
                  <Text style={[styles.codeText, { color: c.primary }]}>{stats?.referralCode}</Text>
                </View>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: copied ? c.muted : c.primary }]}
                  onPress={handleCopy}
                >
                  <Feather name={copied ? "check" : "copy"} size={16} color={copied ? c.foreground : "#fff"} />
                  <Text style={[styles.actionBtnText, { color: copied ? c.foreground : "#fff" }]}>
                    {copied ? "Copied!" : "Copy Link"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.outlineBtn, { borderColor: c.primary }]}
                  onPress={handleShare}
                >
                  <Feather name="share-2" size={16} color={c.primary} />
                  <Text style={[styles.actionBtnText, { color: c.primary }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Enter Referral Code — shown only if user hasn't been referred yet */}
        {!loading && stats?.isReferred === false && (
          <View style={[styles.card, styles.applyCard, { backgroundColor: c.card, borderColor: "#f97316" }]}>
            <View style={styles.applyHeader}>
              <View style={[styles.applyIconBox, { backgroundColor: "#f9731620" }]}>
                <Feather name="tag" size={18} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: c.foreground, marginBottom: 2 }]}>Have a Referral Code?</Text>
                <Text style={[styles.applySubtitle, { color: c.mutedForeground }]}>
                  Signed up via Google or missed entering a code? Enter it here to claim your ₹20 bonus.
                </Text>
              </View>
            </View>
            <View style={styles.applyRow}>
              <TextInput
                style={[styles.applyInput, { backgroundColor: c.muted, color: c.foreground, borderColor: c.border }]}
                placeholder="Enter referral code"
                placeholderTextColor={c.mutedForeground}
                value={manualCode}
                onChangeText={(t) => setManualCode(t.replace(/\s/g, "").toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
              />
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: "#f97316", opacity: applying || !manualCode.trim() ? 0.6 : 1 }]}
                onPress={handleApplyCode}
                disabled={applying || !manualCode.trim()}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.applyHint, { color: c.mutedForeground }]}>
              Each device can only use one referral code. Bonus credited instantly.
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { label: "Total Referrals", value: stats?.totalReferrals ?? 0, icon: "users", color: "#f97316" },
            { label: "Successful", value: stats?.successfulReferrals ?? 0, icon: "check-circle", color: "#059669" },
            { label: "Earnings", value: `₹${stats?.totalEarnings ?? 0}`, icon: "dollar-sign", color: "#6366f1" },
            { label: "Link Clicks", value: stats?.totalClicks ?? 0, icon: "bar-chart-2", color: "#0891b2" },
          ].map(({ label, value, icon, color }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
                <Feather name={icon as any} size={18} color={color} />
              </View>
              <Text style={[styles.statValue, { color: c.foreground }]}>{loading ? "—" : value}</Text>
              <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>How It Works</Text>
          {[
            "Copy or share your referral link",
            "Your friend signs up using your link",
            "₹20 is automatically credited to both wallets!",
          ].map((text, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: c.foreground }]}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Referral List */}
        {referrals.length > 0 && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Section header */}
            <View style={styles.referralListHeader}>
              <View style={[styles.referralListIconBox, { backgroundColor: "#f9731618" }]}>
                <Feather name="users" size={16} color="#f97316" />
              </View>
              <Text style={[styles.cardTitle, { color: c.foreground, marginBottom: 0, flex: 1 }]}>
                Referred Users
              </Text>
              <View style={[styles.referralCountBadge, { backgroundColor: c.primary + "18" }]}>
                <Text style={[styles.referralCountText, { color: c.primary }]}>{referrals.length}</Text>
              </View>
            </View>

            <View style={[styles.referralDivider, { backgroundColor: c.border }]} />

            {referrals.map((r, idx) => {
              const initials = r.name.trim().split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase() || "?";
              const avatarColor = r.status === "completed" ? "#059669" : r.status === "pending" ? "#d97706" : "#dc2626";
              const statusCfg = r.status === "completed"
                ? { bg: "#dcfce7", text: "#16a34a", icon: "check-circle" as const, label: "₹20 Credited" }
                : r.status === "pending"
                ? { bg: "#fef9c3", text: "#ca8a04", icon: "clock" as const, label: "Pending" }
                : { bg: "#fee2e2", text: "#dc2626", icon: "x-circle" as const, label: "Blocked" };

              return (
                <View key={r.id} style={[styles.referralCard, idx > 0 && { marginTop: 10 }]}>
                  {/* Avatar with initials */}
                  <View style={[styles.referralAvatar, { backgroundColor: avatarColor + "18" }]}>
                    <Text style={[styles.referralAvatarText, { color: avatarColor }]}>{initials}</Text>
                  </View>

                  {/* Name + date */}
                  <View style={styles.referralInfo}>
                    <Text style={[styles.referralName, { color: c.foreground }]} numberOfLines={1}>{r.name}</Text>
                    <View style={styles.referralMetaRow}>
                      <Feather name="calendar" size={10} color={c.mutedForeground} />
                      <Text style={[styles.referralDate, { color: c.mutedForeground }]}>
                        {new Date(r.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                  </View>

                  {/* Status pill */}
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Feather name={statusCfg.icon} size={11} color={statusCfg.text} />
                    <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && referrals.length === 0 && (
          <View style={styles.emptyBox}>
            <Feather name="users" size={36} color={c.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No referrals yet. Share your link to get started!</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 8, borderRadius: 8 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  heroBanner: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    backgroundColor: "#f97316",
    alignItems: "center",
  },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 6, textAlign: "center" },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center", marginBottom: 12, lineHeight: 19 },
  heroBadgeRow: { flexDirection: "row", gap: 8 },
  heroBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  linkBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, marginBottom: 10 },
  linkText: { flex: 1, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  codeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  codeText: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 11 },
  outlineBtn: { backgroundColor: "transparent", borderWidth: 1.5 },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: { width: "47%", borderRadius: 14, padding: 14, borderWidth: 1, alignItems: "center", gap: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 11, textAlign: "center" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", shrink: 0 } as any,
  stepNumText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  referralListHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  referralListIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  referralCountBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, minWidth: 28, alignItems: "center" },
  referralCountText: { fontSize: 13, fontWeight: "800" },
  referralDivider: { height: 1, marginBottom: 14 },
  referralCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  referralAvatarText: { fontSize: 16, fontWeight: "900" },
  referralInfo: { flex: 1 },
  referralName: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  referralMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  referralDate: { fontSize: 11 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  statusText: { fontSize: 11, fontWeight: "700" },
  emptyBox: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyText: { fontSize: 13, textAlign: "center" },
  applyCard: { borderWidth: 1.5 },
  applyHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  applyIconBox: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginTop: 2 },
  applySubtitle: { fontSize: 12, lineHeight: 17 },
  applyRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  applyInput: {
    flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1, borderWidth: 1,
  },
  applyBtn: { borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", minWidth: 72 },
  applyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  applyHint: { fontSize: 11, lineHeight: 15 },
});
