import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError } from "@/utils/alert";

const AMOUNTS = [10, 20, 30, 50, 100];
const MAX_DAILY = 100;
const MAX_MONTHLY = 3000;

interface Deposit {
  id: number;
  amount: string;
  utrNumber?: string | null;
  paymentMethod?: string;
  status: "pending" | "success" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: string;
}

type VerifyState = null | "verifying" | "success" | "failed";

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const cfg = {
    pending: { bg: "#FEF3C7", text: "#92400E", icon: "clock" as const, label: "Under Review" },
    approved: { bg: "#D1FAE5", text: "#065F46", icon: "check-circle" as const, label: "Credited" },
    success: { bg: "#D1FAE5", text: "#065F46", icon: "check-circle" as const, label: "Credited" },
    rejected: { bg: "#FEE2E2", text: "#991B1B", icon: "x-circle" as const, label: "Rejected" },
  }[status] ?? { bg: "#F3F4F6", text: "#374151", icon: "circle" as const, label: status };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon} size={12} color={cfg.text} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function PaymentVerifyOverlay({
  state,
  amount,
  onDone,
}: {
  state: VerifyState;
  amount: number;
  onDone: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "verifying") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [state]);

  useEffect(() => {
    if (state === "success" || state === "failed") {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [state]);

  if (!state) return null;

  const isSuccess = state === "success";
  const isFailed = state === "failed";
  const isVerifying = state === "verifying";

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlayBg}>
        <View style={styles.overlayCard}>
          {isVerifying && (
            <>
              <Animated.View style={[styles.overlayIconRing, { borderColor: "#f97316", transform: [{ scale: pulseAnim }] }]}>
                <ActivityIndicator size="large" color="#f97316" />
              </Animated.View>
              <Text style={styles.overlayTitle}>Verifying Payment...</Text>
              <Text style={styles.overlaySub}>Please wait. Checking your payment status.</Text>
              <View style={styles.overlayDots}>
                {[0, 1, 2].map((i) => (
                  <BounceDot key={i} delay={i * 200} />
                ))}
              </View>
              <Text style={styles.overlayHint}>Do not close the app</Text>
            </>
          )}

          {isSuccess && (
            <Animated.View style={{ alignItems: "center", opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
              <View style={[styles.overlayIconRing, { borderColor: "#22c55e", backgroundColor: "#f0fdf4" }]}>
                <Feather name="check" size={40} color="#16a34a" />
              </View>
              <Text style={[styles.overlayTitle, { color: "#16a34a" }]}>Payment Successful!</Text>
              <Text style={[styles.overlayAmount, { color: "#16a34a" }]}>+₹{amount}</Text>
              <Text style={styles.overlaySub}>Added to your wallet</Text>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: "#16a34a" }]} onPress={onDone}>
                <Text style={styles.overlayBtnText}>Go to Wallet →</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {isFailed && (
            <Animated.View style={{ alignItems: "center", opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
              <View style={[styles.overlayIconRing, { borderColor: "#ef4444", backgroundColor: "#fef2f2" }]}>
                <Feather name="x" size={40} color="#dc2626" />
              </View>
              <Text style={[styles.overlayTitle, { color: "#dc2626" }]}>Payment Failed</Text>
              <Text style={styles.overlaySub}>Payment was not completed.{"\n"}No money has been deducted.</Text>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: "#dc2626" }]} onPress={onDone}>
                <Text style={styles.overlayBtnText}>Try Again</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function BounceDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -8, duration: 350, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.dot, { transform: [{ translateY: anim }] }]} />
  );
}

export default function DepositScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [tab, setTab] = useState<"add" | "history">("add");
  const [customAmount, setCustomAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>(null);
  const [verifyAmount, setVerifyAmount] = useState(0);
  const [history, setHistory] = useState<Deposit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [limits, setLimits] = useState<{
    dailyRemaining: number; monthlyRemaining: number;
    dailyUsed: number; monthlyUsed: number;
  }>({ dailyRemaining: MAX_DAILY, monthlyRemaining: MAX_MONTHLY, dailyUsed: 0, monthlyUsed: 0 });

  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const finalAmount = customAmount ? parseFloat(customAmount) : 0;

  const fetchLimits = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${baseUrl}/api/wallet/deposit/limits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setLimits(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/wallet/deposits/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const pollingStopped = useRef(false);

  const stopPolling = () => { pollingStopped.current = true; };

  const startPolling = (depositId: number, amountPaid: number) => {
    pollingStopped.current = false;
    const TIMEOUT_MS = 10 * 60 * 1000;
    const INTERVAL_MS = 2000;
    const startTime = Date.now();

    const tick = async () => {
      if (pollingStopped.current) return;

      if (Date.now() - startTime >= TIMEOUT_MS) {
        stopPolling();
        try {
          await fetch(`${baseUrl}/api/wallet/deposit/instamojo/timeout/${depositId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (_) {}
        WebBrowser.dismissBrowser();
        setPaying(false);
        setVerifyState("failed");
        await fetchHistory();
        return;
      }

      try {
        const res = await fetch(`${baseUrl}/api/wallet/deposits/${depositId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();

          if (data.status === "success") {
            stopPolling();
            WebBrowser.dismissBrowser();
            setPaying(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await Promise.all([fetchHistory(), fetchLimits()]);
            setCustomAmount("");
            setVerifyState("success");
            return;
          }

          if (data.status === "rejected") {
            stopPolling();
            WebBrowser.dismissBrowser();
            setPaying(false);
            await fetchHistory();
            setVerifyState("failed");
            return;
          }
        }
      } catch (_) {}

      if (!pollingStopped.current) setTimeout(tick, INTERVAL_MS);
    };

    setTimeout(tick, INTERVAL_MS);
  };

  const handleVerifyDone = () => {
    if (verifyState === "success") {
      setVerifyState(null);
      setTab("history");
    } else {
      setVerifyState(null);
    }
  };

  const handlePayInstamojo = async () => {
    if (!finalAmount || finalAmount < 10) {
      showError("Invalid Amount", "Please enter a minimum amount of ₹10.");
      return;
    }
    if (finalAmount > MAX_DAILY) {
      showError("Limit Exceeded", `Maximum deposit is ₹${MAX_DAILY} per day.`);
      return;
    }
    if (finalAmount > limits.dailyRemaining) {
      showError("Daily Limit Reached", `You can deposit ₹${limits.dailyRemaining} more today.`);
      return;
    }
    if (finalAmount > limits.monthlyRemaining) {
      showError("Monthly Limit Reached", `You can deposit ₹${limits.monthlyRemaining} more this month.`);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaying(true);

    try {
      const res = await fetch(`${baseUrl}/api/wallet/deposit/instamojo/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount, source: "mobile" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError("Payment Error", data.error ?? "Could not initiate payment. Please try again.");
        setPaying(false);
        return;
      }

      const { paymentUrl, depositId } = data;
      setVerifyAmount(finalAmount);

      // Start background polling before opening browser
      startPolling(depositId, finalAmount);

      // Open browser — polling runs simultaneously
      await WebBrowser.openBrowserAsync(paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // Browser closed — show verifying overlay if not already resolved
      if (!pollingStopped.current) {
        setVerifyState("verifying");
      }
    } catch (e: any) {
      stopPolling();
      setPaying(false);
      setVerifyState(null);
      showError("Error", e.message ?? "Something went wrong. Please try again.");
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const handleBack = () => {
    if (tab === "history") { setTab("add"); return; }
    router.back();
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <PaymentVerifyOverlay state={verifyState} amount={verifyAmount} onDone={handleVerifyDone} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {tab === "history" ? "Deposit History" : "Add Money"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, tab === "add" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => setTab("add")}
        >
          <Text style={[styles.tabText, { color: tab === "add" ? colors.primary : colors.mutedForeground }]}>Add Money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "history" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => { setTab("history"); fetchHistory(); }}
        >
          <Text style={[styles.tabText, { color: tab === "history" ? colors.primary : colors.mutedForeground }]}>
            History {history.length > 0 ? `(${history.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ─── ADD MONEY ─── */}
        {tab === "add" && (
          <>
            {/* Secure payment badge */}
            <View style={[styles.imBadge, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
              <Feather name="shield" size={14} color="#16a34a" />
              <Text style={[styles.imBadgeText, { color: "#166534" }]}>100% Secure & Instant Wallet Top-Up</Text>
            </View>

            {/* Amount chips */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Select Amount</Text>
            <View style={styles.amountGrid}>
              {AMOUNTS.map((amt) => {
                const isSelected = customAmount === String(amt);
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.amountChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCustomAmount(String(amt))}
                  >
                    <Text style={[styles.amountChipText, { color: isSelected ? "#fff" : colors.foreground }]}>
                      ₹{amt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom amount */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>Or enter custom amount</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: finalAmount >= 10 ? colors.primary : colors.border }]}>
              <Text style={[styles.rupeeSign, { color: colors.saffron }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.foreground }]}
                placeholder="Enter amount"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={setCustomAmount}
              />
            </View>

            {/* Limits info */}
            <View style={[styles.noteBox, { backgroundColor: colors.saffronLight }]}>
              <Feather name="info" size={14} color={colors.saffron} />
              <Text style={[styles.noteText, { color: colors.saffron }]}>
                Min ₹10 · Max ₹{MAX_DAILY}/day · ₹{MAX_MONTHLY.toLocaleString("en-IN")}/month{"\n"}
                Today remaining: ₹{limits.dailyRemaining} · This month: ₹{limits.monthlyRemaining.toLocaleString("en-IN")}
              </Text>
            </View>

            {/* Pay button */}
            <TouchableOpacity
              style={[
                styles.payBtn,
                { backgroundColor: colors.primary, opacity: finalAmount >= 10 && !paying ? 1 : 0.5 },
              ]}
              onPress={handlePayInstamojo}
              disabled={finalAmount < 10 || paying}
            >
              {paying ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.payBtnText, { color: "#fff" }]}>Opening Payment Page...</Text>
                </View>
              ) : (
                <>
                  <Feather name="credit-card" size={18} color="#fff" />
                  <Text style={[styles.payBtnText, { color: "#fff" }]}>
                    Add ₹{finalAmount || "—"} To Wallet
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              You will be redirected to our secure payment page. Money is credited instantly after payment.
            </Text>
          </>
        )}

        {/* ─── HISTORY ─── */}
        {tab === "history" && (
          <>
            {historyLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : history.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={40} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No deposits yet</Text>
              </View>
            ) : (
              history.map((d) => {
                const isGood = d.status === "approved" || d.status === "success";
                const isBad = d.status === "rejected";
                const isInstamojo = d.paymentMethod === "instamojo";
                return (
                  <View
                    key={d.id}
                    style={[
                      styles.historyCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isGood ? "#BBF7D0" : isBad ? "#FECACA" : colors.border,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <View style={styles.historyTop}>
                      <View>
                        <Text style={[styles.historyAmount, { color: colors.foreground }]}>
                          ₹{Number(d.amount).toLocaleString("en-IN")}
                        </Text>
                        <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                          {formatDate(d.createdAt)}
                        </Text>
                        <View style={[styles.methodBadge, { backgroundColor: isInstamojo ? "#F0FDF4" : "#F3F4F6" }]}>
                          <Text style={[styles.methodBadgeText, { color: isInstamojo ? "#166534" : "#6B7280" }]}>
                            {isInstamojo ? "Online Payment" : "UPI Manual"}
                          </Text>
                        </View>
                      </View>
                      <StatusBadge status={d.status} />
                    </View>

                    {d.utrNumber && (
                      <View style={[styles.refRow, { backgroundColor: colors.secondary, borderRadius: 8, padding: 10, marginTop: 10 }]}>
                        <Text style={[styles.refText, { color: colors.mutedForeground }]}>
                          Ref: <Text style={{ fontWeight: "700", color: colors.foreground }}>{d.utrNumber}</Text>
                        </Text>
                      </View>
                    )}

                    {isGood && (
                      <View style={[styles.statusBox, { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" }]}>
                        <Feather name="check-circle" size={14} color="#065F46" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: "#065F46" }}>
                            Payment Verified — Amount Credited ✅
                          </Text>
                          <Text style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>
                            ₹{Number(d.amount).toLocaleString("en-IN")} added to your wallet
                          </Text>
                        </View>
                      </View>
                    )}
                    {isBad && (
                      <View style={[styles.statusBox, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
                        <Feather name="x-circle" size={14} color="#991B1B" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: "#991B1B" }}>Payment Failed</Text>
                          <Text style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>
                            {d.adminNote ?? "Contact support if money was deducted."}
                          </Text>
                        </View>
                      </View>
                    )}
                    {!isGood && !isBad && (
                      <View style={[styles.statusBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                        <Feather name="clock" size={14} color="#92400E" />
                        <Text style={{ fontSize: 12, color: "#92400E", flex: 1 }}>
                          {isInstamojo ? "Payment initiated — under review · Will be credited shortly" : "Under review · Will be credited within 1–4 hours"}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 20, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "700" },
  imBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20 },
  imBadgeText: { fontSize: 12, fontWeight: "600", flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amountChip: { width: "30%", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  amountChipText: { fontSize: 16, fontWeight: "700" },
  inputBox: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 4, gap: 8, marginBottom: 16 },
  rupeeSign: { fontSize: 22, fontWeight: "800" },
  amountInput: { flex: 1, fontSize: 20, fontWeight: "700", paddingVertical: 12 },
  noteBox: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 14, marginBottom: 20, alignItems: "flex-start" },
  noteText: { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 20 },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  payBtnText: { fontSize: 16, fontWeight: "800" },
  footerNote: { textAlign: "center", fontSize: 12, lineHeight: 18 },
  empty: { alignItems: "center", gap: 12, marginTop: 60 },
  emptyText: { fontSize: 14 },
  historyCard: { borderRadius: 14, padding: 16, marginBottom: 14 },
  historyTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  historyAmount: { fontSize: 20, fontWeight: "800" },
  historyDate: { fontSize: 12, marginTop: 2 },
  methodBadge: { marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  methodBadgeText: { fontSize: 11, fontWeight: "700" },
  refRow: {},
  refText: { fontSize: 12 },
  statusBox: { flexDirection: "row", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 10, alignItems: "flex-start" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  // Overlay
  overlayBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  overlayCard: { backgroundColor: "#0f172a", borderRadius: 28, padding: 40, width: "100%", maxWidth: 360, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" },
  overlayIconRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  overlayTitle: { fontSize: 22, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 },
  overlayAmount: { fontSize: 36, fontWeight: "900", marginBottom: 6 },
  overlaySub: { fontSize: 14, color: "#94a3b8", textAlign: "center", lineHeight: 22, marginBottom: 8 },
  overlayHint: { fontSize: 12, color: "#475569", marginTop: 20 },
  overlayDots: { flexDirection: "row", gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#f97316" },
  overlayBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  overlayBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
