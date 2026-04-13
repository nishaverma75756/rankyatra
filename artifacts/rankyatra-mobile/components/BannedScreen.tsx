import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatCountdown(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, ms);
  const s = Math.floor((total / 1000) % 60);
  const m = Math.floor((total / 1000 / 60) % 60);
  const h = Math.floor((total / 1000 / 60 / 60) % 24);
  const d = Math.floor(total / 1000 / 60 / 60 / 24);
  return { d, h, m, s };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function BannedScreen() {
  const { banInfo, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const expiryMs = banInfo ? new Date(banInfo.bannedUntil).getTime() : 0;
  const [remaining, setRemaining] = useState(expiryMs - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const r = expiryMs - Date.now();
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  const { d, h, m, s } = formatCountdown(remaining);
  const expired = remaining <= 0;

  const expiryDate = banInfo
    ? new Date(banInfo.bannedUntil).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
      })
    : "";

  return (
    <View style={[styles.container, { backgroundColor: "#0a0a0a", paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Feather name="shield-off" size={40} color="#f87171" />
          </View>
        </View>

        <Text style={styles.title}>Account Suspended</Text>
        <Text style={styles.subtitle}>
          Your account has been temporarily suspended by the RankYatra team.
        </Text>

        {/* Reason Box */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>REASON</Text>
          <Text style={styles.reasonText}>
            {banInfo?.banReason ?? "Account temporarily suspended"}
          </Text>
        </View>

        {/* Countdown */}
        {!expired ? (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownLabel}>SUSPENSION ENDS IN</Text>
            <View style={styles.countdownRow}>
              {d > 0 && (
                <View style={styles.countdownCell}>
                  <Text style={styles.countdownNum}>{pad(d)}</Text>
                  <Text style={styles.countdownUnit}>Days</Text>
                </View>
              )}
              <View style={styles.countdownCell}>
                <Text style={styles.countdownNum}>{pad(h)}</Text>
                <Text style={styles.countdownUnit}>Hours</Text>
              </View>
              <View style={styles.countdownCell}>
                <Text style={styles.countdownNum}>{pad(m)}</Text>
                <Text style={styles.countdownUnit}>Min</Text>
              </View>
              <View style={styles.countdownCell}>
                <Text style={[styles.countdownNum, { color: "#f97316" }]}>{pad(s)}</Text>
                <Text style={styles.countdownUnit}>Sec</Text>
              </View>
            </View>
            <Text style={styles.expiryText}>Expires: {expiryDate} IST</Text>
          </View>
        ) : (
          <View style={styles.expiredBox}>
            <Feather name="check-circle" size={24} color="#4ade80" />
            <Text style={styles.expiredText}>
              Your suspension has expired. Please re-open the app or log back in.
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Feather name="info" size={16} color="#a7a9be" style={{ marginTop: 2 }} />
          <Text style={styles.infoText}>
            During suspension, you cannot access your account. Your wallet balance and data are safe and will be fully restored once the suspension ends.
          </Text>
        </View>

        {/* Support */}
        <Text style={styles.supportText}>
          If you believe this is a mistake, contact us at{" "}
          <Text style={{ color: "#f97316" }}>support@rankyatra.in</Text>
        </Text>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Feather name="log-out" size={16} color="#f87171" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  iconWrap: { marginBottom: 20 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#f8717120", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#f8717140",
  },

  title: { fontSize: 26, fontWeight: "900", color: "#fffffe", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 15, color: "#a7a9be", textAlign: "center", lineHeight: 22, marginBottom: 24 },

  reasonBox: {
    width: "100%", backgroundColor: "#1a1017", borderRadius: 14,
    borderWidth: 1, borderColor: "#f8717130", padding: 18, marginBottom: 24,
  },
  reasonLabel: { fontSize: 10, fontWeight: "800", color: "#f87171", letterSpacing: 2, marginBottom: 8 },
  reasonText: { fontSize: 15, color: "#fffffe", lineHeight: 22 },

  countdownWrap: { width: "100%", alignItems: "center", marginBottom: 24 },
  countdownLabel: { fontSize: 10, fontWeight: "800", color: "#a7a9be", letterSpacing: 2, marginBottom: 16 },
  countdownRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  countdownCell: {
    backgroundColor: "#1a1929", borderRadius: 12, padding: 16, minWidth: 70, alignItems: "center",
    borderWidth: 1, borderColor: "#2e2d3d",
  },
  countdownNum: { fontSize: 32, fontWeight: "900", color: "#fffffe" },
  countdownUnit: { fontSize: 11, color: "#a7a9be", marginTop: 4 },
  expiryText: { fontSize: 12, color: "#666", marginTop: 4 },

  expiredBox: {
    flexDirection: "row", gap: 10, backgroundColor: "#0f2010", borderRadius: 14,
    borderWidth: 1, borderColor: "#4ade8030", padding: 16, marginBottom: 24, width: "100%",
  },
  expiredText: { flex: 1, fontSize: 14, color: "#4ade80", lineHeight: 20 },

  infoBox: {
    flexDirection: "row", gap: 10, backgroundColor: "#1a1929", borderRadius: 12,
    padding: 14, marginBottom: 20, width: "100%",
  },
  infoText: { flex: 1, fontSize: 13, color: "#a7a9be", lineHeight: 19 },

  supportText: { fontSize: 13, color: "#666", textAlign: "center", lineHeight: 20, marginBottom: 28 },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 28,
    borderRadius: 12, borderWidth: 1, borderColor: "#f8717150",
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#f87171" },
});
