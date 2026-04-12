import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError } from "@/utils/alert";
import { customFetch } from "@workspace/api-client-react";

interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
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

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  useEffect(() => {
    if (!token) return;
    Promise.all([
      customFetch<ReferralStats>("/api/referral/stats"),
      customFetch<ReferralEntry[]>("/api/referral/list"),
    ])
      .then(([s, l]) => {
        setStats(s as any);
        setReferrals(Array.isArray(l) ? l as any[] : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

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
        message: `🚀 RankYatra pe join karo aur ₹20 bonus pao!\n\nMera referral link: ${stats.referralLink}`,
        title: "RankYatra — Refer & Earn",
      });
    } catch {}
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
          <Text style={styles.heroTitle}>Dono ko milega ₹20!</Text>
          <Text style={styles.heroSubtitle}>Friend ko refer karo — dono ke wallet mein ₹20 bonus automatically credit hoga</Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✅ Aap ko ₹20</Text></View>
            <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✅ Friend ko ₹20</Text></View>
          </View>
        </View>

        {/* Referral Link Card */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Aapka Referral Link</Text>
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
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Kaise Kaam Karta Hai?</Text>
          {[
            "Apna referral link copy karo ya share karo",
            "Friend us link se sign up kare",
            "Dono ke wallet mein ₹20-₹20 automatically credit ho jaega!",
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
          <View style={[styles.card, styles.listCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Referred Users ({referrals.length})</Text>
            {referrals.map((r) => (
              <View key={r.id} style={[styles.referralRow, { borderTopColor: c.border }]}>
                <View style={styles.referralInfo}>
                  <Text style={[styles.referralName, { color: c.foreground }]}>{r.name}</Text>
                  <Text style={[styles.referralDate, { color: c.mutedForeground }]}>
                    {new Date(r.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  r.status === "completed" && { backgroundColor: "#dcfce7" },
                  r.status === "pending" && { backgroundColor: "#fef9c3" },
                  r.status === "blocked" && { backgroundColor: "#fee2e2" },
                ]}>
                  <Text style={[
                    styles.statusText,
                    r.status === "completed" && { color: "#16a34a" },
                    r.status === "pending" && { color: "#ca8a04" },
                    r.status === "blocked" && { color: "#dc2626" },
                  ]}>
                    {r.status === "completed" ? "✅ ₹20 Credited" : r.status === "pending" ? "⏳ Pending" : "❌ Blocked"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && referrals.length === 0 && (
          <View style={styles.emptyBox}>
            <Feather name="users" size={36} color={c.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Abhi koi referral nahi. Link share karo!</Text>
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
  listCard: { padding: 0, paddingTop: 16 },
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
  referralRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  referralInfo: { flex: 1 },
  referralName: { fontSize: 14, fontWeight: "700" },
  referralDate: { fontSize: 11, marginTop: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  emptyBox: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyText: { fontSize: 13, textAlign: "center" },
});
