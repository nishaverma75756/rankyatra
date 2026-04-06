import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showSuccess, showError } from "@/utils/alert";

const AMOUNTS = [10, 20, 30, 50, 100];
const MAX_DAILY = 100;
const MAX_MONTHLY = 3000;

interface Deposit {
  id: number;
  amount: string;
  utrNumber: string;
  status: "pending" | "success" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: string;
}

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

async function fetchPaymentSettings(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/payment/settings`);
  return res.json();
}

async function submitDeposit(baseUrl: string, token: string, amount: number, utrNumber: string) {
  const res = await fetch(`${baseUrl}/api/wallet/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount, utrNumber }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to submit");
  }
  return res.json();
}

export default function DepositScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [tab, setTab] = useState<"add" | "history">("add");
  const [step, setStep] = useState<"amount" | "payment" | "utr">("amount");
  const [customAmount, setCustomAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<{ qrCodeUrl: string | null; upiId: string | null }>({ qrCodeUrl: null, upiId: null });
  const [settingsLoading, setSettingsLoading] = useState(true);
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

  useEffect(() => {
    fetchPaymentSettings(baseUrl)
      .then(setSettings)
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
    fetchLimits();
  }, [fetchLimits]);

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

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleContinue = () => {
    if (!finalAmount || finalAmount < 10) {
      showError("Invalid Amount", "Please enter a minimum amount of ₹10.");
      return;
    }
    if (finalAmount > MAX_DAILY) {
      showError("Limit Exceeded", `Maximum deposit is ₹${MAX_DAILY} per day.`);
      return;
    }
    if (finalAmount > limits.dailyRemaining) {
      showError(
        "Daily Limit Reached",
        `You can only deposit ₹${limits.dailyRemaining} more today. Daily limit: ₹${MAX_DAILY}.`
      );
      return;
    }
    if (finalAmount > limits.monthlyRemaining) {
      showError(
        "Monthly Limit Reached",
        `You can only deposit ₹${limits.monthlyRemaining} more this month. Monthly limit: ₹${MAX_MONTHLY}.`
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("payment");
  };

  const handleSubmitUtr = async () => {
    const cleanUtr = utr.trim();
    if (cleanUtr.length < 6) {
      showError("Invalid UTR", "Please enter a valid UTR / transaction reference number (minimum 6 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await submitDeposit(baseUrl, token ?? "", finalAmount, cleanUtr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([fetchHistory(), fetchLimits()]);
      setCustomAmount("");
      setUtr("");
      setStep("amount");
      setTab("history");
      showSuccess(
        "Request Submitted! ✅",
        `Your payment of ₹${finalAmount} is under review. It will be credited within 1–4 hours after verification.`
      );
    } catch (e: any) {
      showError("Submission Failed", e.message ?? "Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const headerTitle = tab === "history"
    ? "Deposit History"
    : step === "amount" ? "Add Money" : step === "payment" ? "Scan & Pay" : "Enter UTR";

  const handleBack = () => {
    if (tab === "history") {
      setTab("add");
      return;
    }
    if (step === "amount") router.back();
    else if (step === "utr") setStep("payment");
    else setStep("amount");
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{headerTitle}</Text>
        <View style={{ width: 36 }} />
      </View>

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

      {tab === "add" && (
        <View style={styles.steps}>
          {[1, 2, 3].map((n) => {
            const stepNum = step === "amount" ? 1 : step === "payment" ? 2 : 3;
            const active = n === stepNum;
            const done = n < stepNum;
            return (
              <View key={n} style={styles.stepRow}>
                <View style={[styles.stepCircle, { backgroundColor: done || active ? colors.primary : colors.muted }]}>
                  {done
                    ? <Feather name="check" size={12} color="#fff" />
                    : <Text style={styles.stepNum}>{n}</Text>
                  }
                </View>
                {n < 3 && <View style={[styles.stepLine, { backgroundColor: done ? colors.primary : colors.border }]} />}
              </View>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {tab === "add" && step === "amount" && (
          <>
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

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>Or enter custom amount</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

            <View style={[styles.noteBox, { backgroundColor: colors.saffronLight }]}>
              <Feather name="info" size={14} color={colors.saffron} />
              <Text style={[styles.noteText, { color: colors.saffron }]}>
                Min ₹10 · Max ₹{MAX_DAILY}/day · ₹{MAX_MONTHLY.toLocaleString("en-IN")}/month{"\n"}
                Today remaining: ₹{limits.dailyRemaining} · This month: ₹{limits.monthlyRemaining.toLocaleString("en-IN")}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.continueBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: finalAmount >= 10 && finalAmount <= limits.dailyRemaining && finalAmount <= limits.monthlyRemaining ? 1 : 0.5,
                },
              ]}
              onPress={handleContinue}
              disabled={finalAmount < 10}
            >
              <Text style={[styles.continueBtnText, { color: colors.primaryForeground }]}>
                Continue with ₹{finalAmount || "—"}
              </Text>
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </>
        )}

        {tab === "add" && step === "payment" && (
          <>
            <View style={[styles.amountBadge, { backgroundColor: colors.saffronLight }]}>
              <Text style={[styles.amountBadgeText, { color: colors.saffron }]}>Pay ₹{finalAmount}</Text>
            </View>

            {settingsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
            ) : settings.qrCodeUrl ? (
              <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.qrLabel, { color: colors.mutedForeground }]}>Scan QR to pay</Text>
                <Image source={{ uri: settings.qrCodeUrl }} style={styles.qrImage} resizeMode="contain" />
                {settings.upiId && (
                  <View style={[styles.upiRow, { backgroundColor: colors.secondary }]}>
                    <Feather name="smartphone" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.upiText, { color: colors.foreground }]}>{settings.upiId}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.noQrBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
                <Text style={[styles.noQrText, { color: colors.mutedForeground }]}>
                  Payment QR not set up yet. Contact admin.
                </Text>
              </View>
            )}

            <View style={[styles.instructionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.instrTitle, { color: colors.foreground }]}>How to pay:</Text>
              {[
                "Open your UPI app (GPay, PhonePe, Paytm, etc.)",
                `Scan the QR code above and pay ₹${finalAmount}`,
                "Copy the UTR/Transaction ID shown after payment",
                "Click 'I have paid' and enter the UTR below",
              ].map((s, i) => (
                <View key={i} style={styles.instrRow}>
                  <View style={[styles.instrNum, { backgroundColor: colors.primary }]}>
                    <Text style={styles.instrNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.instrText, { color: colors.mutedForeground }]}>{s}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: "#22c55e" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("utr"); }}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={[styles.continueBtnText, { color: "#fff" }]}>I have Paid — Enter UTR</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === "add" && step === "utr" && (
          <>
            <View style={[styles.amountBadge, { backgroundColor: colors.saffronLight }]}>
              <Text style={[styles.amountBadgeText, { color: colors.saffron }]}>Amount: ₹{finalAmount}</Text>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>UTR / Transaction Reference</Text>

            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="hash" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.utrInput, { color: colors.foreground }]}
                placeholder="Enter UTR / Ref number"
                placeholderTextColor={colors.mutedForeground}
                value={utr}
                onChangeText={setUtr}
                autoCapitalize="characters"
              />
            </View>

            <View style={[styles.noteBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                UTR is the 12-digit reference number shown in your payment receipt. Example: 123456789012
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: colors.primary, opacity: utr.trim().length >= 6 ? 1 : 0.5 }]}
              onPress={handleSubmitUtr}
              disabled={submitting || utr.trim().length < 6}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#fff" />
                  <Text style={[styles.continueBtnText, { color: "#fff" }]}>Submit Payment Request</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              Your request will be reviewed and money credited within 1–4 hours.
            </Text>
          </>
        )}

        {tab === "history" && (
          <>
            {historyLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : history.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={40} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No deposit requests yet</Text>
              </View>
            ) : (
              history.map((d) => (
                <View
                  key={d.id}
                  style={[
                    styles.historyCard,
                    {
                      backgroundColor: colors.card,
                      borderColor:
                        (d.status === "approved" || d.status === "success") ? "#BBF7D0"
                        : d.status === "rejected" ? "#FECACA"
                        : colors.border,
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
                    </View>
                    <StatusBadge status={d.status} />
                  </View>

                  <View style={[styles.utrRow, { backgroundColor: colors.secondary, borderRadius: 8, padding: 10, marginTop: 10 }]}>
                    <Feather name="hash" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.utrText, { color: colors.mutedForeground }]}>
                      UTR: <Text style={{ fontWeight: "700", color: colors.foreground }}>{d.utrNumber}</Text>
                    </Text>
                  </View>

                  {(d.status === "approved" || d.status === "success") && (
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

                  {d.status === "rejected" && (
                    <View style={[styles.statusBox, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
                      <Feather name="x-circle" size={14} color="#991B1B" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#991B1B" }}>
                          Payment Rejected
                        </Text>
                        {d.adminNote ? (
                          <Text style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>
                            Reason: {d.adminNote}
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>
                            Invalid or duplicate UTR. Please contact support.
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {d.status !== "approved" && d.status !== "success" && d.status !== "rejected" && (
                    <View style={[styles.statusBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                      <Feather name="clock" size={14} color="#92400E" />
                      <Text style={{ fontSize: 12, color: "#92400E", flex: 1 }}>
                        Under review · Will be credited within 1–4 hours
                      </Text>
                    </View>
                  )}
                </View>
              ))
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
  steps: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 0 },
  stepRow: { flexDirection: "row", alignItems: "center" },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepNum: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepLine: { width: 48, height: 2 },
  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amountChip: { width: "30%", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  amountChipText: { fontSize: 16, fontWeight: "700" },
  inputBox: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 4, gap: 8, marginBottom: 16 },
  rupeeSign: { fontSize: 22, fontWeight: "800" },
  amountInput: { flex: 1, fontSize: 20, fontWeight: "700", paddingVertical: 12 },
  utrInput: { flex: 1, fontSize: 16, fontWeight: "600", paddingVertical: 12 },
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  continueBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 16, marginTop: 8 },
  continueBtnText: { fontSize: 16, fontWeight: "800" },
  amountBadge: { alignSelf: "center", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  amountBadgeText: { fontSize: 18, fontWeight: "800" },
  qrCard: { borderRadius: 20, borderWidth: 1.5, padding: 20, alignItems: "center", marginBottom: 20 },
  qrLabel: { fontSize: 13, marginBottom: 12, fontWeight: "600" },
  qrImage: { width: 220, height: 220, borderRadius: 12, marginBottom: 12 },
  upiRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  upiText: { fontSize: 14, fontWeight: "600" },
  noQrBox: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: "center", gap: 12, marginBottom: 20 },
  noQrText: { fontSize: 14, textAlign: "center" },
  instructionCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, gap: 12 },
  instrTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  instrRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  instrNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  instrNumText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  instrText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footerNote: { textAlign: "center", fontSize: 12, marginTop: 16 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  historyCard: { borderRadius: 16, padding: 14, marginBottom: 14 },
  historyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyAmount: { fontSize: 22, fontWeight: "900" },
  historyDate: { fontSize: 12, marginTop: 3 },
  utrRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  utrText: { fontSize: 12 },
  statusBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
