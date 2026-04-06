import React, { useState, useEffect, useCallback } from "react";
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
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useGetWalletBalance } from "@workspace/api-client-react";
import { showSuccess, showError, showConfirm } from "@/utils/alert";

const AMOUNTS = [50, 100, 200, 500, 1000, 2000];

const BANKS = [
  "State Bank of India (SBI)",
  "Punjab National Bank (PNB)",
  "Bank of Baroda (BoB)",
  "Bank of India (BoI)",
  "Union Bank of India",
  "Canara Bank",
  "Bank of Maharashtra",
  "Central Bank of India",
  "Indian Overseas Bank (IOB)",
  "Indian Bank",
  "UCO Bank",
  "Punjab & Sind Bank",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IndusInd Bank",
  "Yes Bank",
  "Federal Bank",
  "Bandhan Bank",
  "IDBI Bank",
  "City Union Bank",
  "South Indian Bank",
  "Karur Vysya Bank",
  "Tamilnad Mercantile Bank",
];

const STORAGE_KEY = "@rankyatra/saved_payment_method";

interface SavedPayment {
  method: "upi" | "bank";
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
}

interface Withdrawal {
  id: number;
  amount: string;
  paymentMethod: string;
  paymentDetails: string;
  status: "pending" | "approved" | "rejected";
  adminUtrNumber: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const cfg = {
    pending: { bg: "#FEF3C7", text: "#92400E", icon: "clock" as const, label: "Under Review" },
    approved: { bg: "#D1FAE5", text: "#065F46", icon: "check-circle" as const, label: "Approved" },
    rejected: { bg: "#FEE2E2", text: "#991B1B", icon: "x-circle" as const, label: "Rejected" },
  }[status] ?? { bg: "#F3F4F6", text: "#374151", icon: "circle" as const, label: status };

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon} size={12} color={cfg.text} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

export default function WithdrawScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const verificationStatus = (user as any)?.verificationStatus ?? "not_submitted";
  const isVerified = verificationStatus === "verified";

  if (!isVerified) {
    const isUnderReview = verificationStatus === "under_review";
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Withdraw Money</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.lockScreen}>
          <View style={[styles.lockIconWrap, { backgroundColor: isUnderReview ? "#fef3c7" : "#fee2e2" }]}>
            <Feather
              name={isUnderReview ? "clock" : "lock"}
              size={48}
              color={isUnderReview ? "#d97706" : "#ef4444"}
            />
          </View>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>
            {isUnderReview ? "Verification Under Review" : "KYC Verification Required"}
          </Text>
          <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
            {isUnderReview
              ? "Your documents are being reviewed by our team. Withdrawal will be unlocked once verified (usually 24–48 hours)."
              : "KYC verification is required before you can withdraw. Please submit your Government ID and PAN card."}
          </Text>

          {!isUnderReview && (
            <TouchableOpacity
              style={[styles.lockBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/verify")}
            >
              <Feather name="shield" size={18} color={colors.primaryForeground} />
              <Text style={[styles.lockBtnText, { color: colors.primaryForeground }]}>
                Verify My Profile
              </Text>
            </TouchableOpacity>
          )}

          {isUnderReview && (
            <View style={[styles.reviewNote, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
              <Feather name="info" size={14} color="#d97706" />
              <Text style={{ fontSize: 13, color: "#92400e", flex: 1, lineHeight: 18 }}>
                Documents received. Admin review in progress — please wait.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.lockBtnOutline, { borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.lockBtnOutlineText, { color: colors.mutedForeground }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [tab, setTab] = useState<"request" | "history">("request");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "bank">("upi");

  const [upiId, setUpiId] = useState("");

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  const [savedPayment, setSavedPayment] = useState<SavedPayment | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const { data: walletData, refetch: refetchBalance } = useGetWalletBalance();
  const totalBalance = parseFloat(String(walletData?.balance ?? 0));
  const winningBalance = parseFloat(String((walletData as any)?.winningBalance ?? 0));
  const depositBalance = parseFloat(String((walletData as any)?.depositBalance ?? Math.max(0, totalBalance - winningBalance).toFixed(2)));

  const finalAmount = customAmount ? parseFloat(customAmount) : 0;
  const amountExceedsBalance = finalAmount > 0 && finalAmount > winningBalance;

  const buildPaymentDetails = () => {
    if (paymentMethod === "upi") return upiId.trim();
    return [
      `Account Number: ${accountNumber.trim()}`,
      `IFSC Code: ${ifscCode.trim().toUpperCase()}`,
      `Account Holder Name: ${accountHolderName.trim()}`,
      `Bank Name: ${bankName}`,
    ].join("\n");
  };

  const paymentDetails = buildPaymentDetails();

  const filteredBanks = BANKS.filter((b) =>
    b.toLowerCase().includes(bankSearch.toLowerCase())
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: SavedPayment = JSON.parse(raw);
        setSavedPayment(saved);
        applyPaymentData(saved);
        setUsingSaved(true);
      } catch {}
    });
  }, []);

  const applyPaymentData = (data: SavedPayment) => {
    setPaymentMethod(data.method);
    if (data.method === "upi") {
      setUpiId(data.upiId ?? "");
    } else {
      setBankName(data.bankName ?? "");
      setAccountNumber(data.accountNumber ?? "");
      setIfscCode(data.ifscCode ?? "");
      setAccountHolderName(data.accountHolderName ?? "");
    }
  };

  const clearSavedAndReset = () => {
    setUsingSaved(false);
    setUpiId("");
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
    setAccountHolderName("");
  };

  const fetchHistory = async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/wallet/withdrawals/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleSubmit = () => {
    if (!finalAmount || finalAmount < 10) {
      showError("Invalid Amount", "Minimum withdrawal amount is ₹10.");
      return;
    }
    if (winningBalance <= 0) {
      showError("No Winnings", "You have no winning balance to withdraw. Play exams and win to earn withdrawable balance.");
      return;
    }
    if (amountExceedsBalance) {
      showError("Insufficient Winning Balance", `Your withdrawable winnings are ₹${winningBalance.toFixed(2)}. Deposit balance cannot be withdrawn.`);
      return;
    }

    if (paymentMethod === "upi") {
      if (!upiId.trim()) {
        showError("Missing Details", "Please enter your UPI ID.");
        return;
      }
    } else {
      if (!bankName) { showError("Missing Details", "Please select your bank."); return; }
      if (!accountNumber.trim()) { showError("Missing Details", "Please enter your account number."); return; }
      if (!ifscCode.trim()) { showError("Missing Details", "Please enter your IFSC code."); return; }
      if (!accountHolderName.trim()) { showError("Missing Details", "Please enter the account holder name."); return; }
    }

    showConfirm(
      "Confirm Withdrawal",
      `₹${finalAmount} will be deducted from your wallet immediately and transferred to your ${paymentMethod === "upi" ? "UPI ID" : "bank account"} after admin approval.\n\nProceed?`,
      async () => {
        setSubmitting(true);
        try {
          const res = await fetch(`${baseUrl}/api/wallet/withdraw`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount: finalAmount, paymentMethod, paymentDetails }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to submit");

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          const toSave: SavedPayment =
            paymentMethod === "upi"
              ? { method: "upi", upiId: upiId.trim() }
              : { method: "bank", bankName, accountNumber: accountNumber.trim(), ifscCode: ifscCode.trim().toUpperCase(), accountHolderName: accountHolderName.trim() };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
          setSavedPayment(toSave);
          setUsingSaved(true);

          await refetchBalance();
          setCustomAmount("");
          await fetchHistory();
          setTab("history");
          showSuccess(
            "Request Submitted! ✅",
            `₹${finalAmount} has been deducted from your wallet. Your withdrawal is under review and will be processed within 24 hours.`
          );
        } catch (e: any) {
          showError("Failed", e.message ?? "Could not submit withdrawal.");
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const isFormValid = (() => {
    if (!finalAmount || finalAmount < 10 || amountExceedsBalance || winningBalance <= 0) return false;
    if (paymentMethod === "upi") return !!upiId.trim();
    return !!(bankName && accountNumber.trim() && ifscCode.trim() && accountHolderName.trim());
  })();

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Withdraw Money</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Winning balance (withdrawable) */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 6 }}>
        <View style={[styles.balancePill, { backgroundColor: "#22c55e18" }]}>
          <Feather name="trending-up" size={14} color="#16a34a" />
          <Text style={[styles.balanceText, { color: "#16a34a" }]}>
            Withdrawable Winnings: <Text style={{ fontWeight: "900" }}>₹{winningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Text>
        </View>
        <View style={[styles.balancePill, { backgroundColor: colors.muted }]}>
          <Feather name="lock" size={13} color={colors.mutedForeground} />
          <Text style={[styles.balanceText, { color: colors.mutedForeground }]}>
            Deposit Balance (play only): <Text style={{ fontWeight: "800" }}>₹{depositBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.tabs, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, tab === "request" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => setTab("request")}
        >
          <Text style={[styles.tabText, { color: tab === "request" ? colors.primary : colors.mutedForeground }]}>New Request</Text>
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

        {tab === "request" && (
          <>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Withdrawal Amount</Text>
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
                        opacity: amt > winningBalance ? 0.4 : 1,
                      },
                    ]}
                    onPress={() => { if (amt <= winningBalance) setCustomAmount(String(amt)); }}
                  >
                    <Text style={[styles.amountChipText, { color: isSelected ? "#fff" : colors.foreground }]}>₹{amt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: amountExceedsBalance ? "#DC2626" : colors.border }]}>
              <Text style={[styles.rupee, { color: colors.saffron }]}>₹</Text>
              <TextInput
                style={[styles.amtInput, { color: colors.foreground }]}
                placeholder="Custom amount"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={setCustomAmount}
              />
            </View>
            {amountExceedsBalance && (
              <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 4, marginLeft: 2 }}>
                ⚠ Exceeds withdrawable winnings of ₹{winningBalance.toFixed(2)}
              </Text>
            )}

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 20 }]}>Payment Method</Text>
            <View style={styles.methodRow}>
              {(["upi", "bank"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodChip,
                    { backgroundColor: paymentMethod === m ? colors.primary : colors.card, borderColor: paymentMethod === m ? colors.primary : colors.border },
                  ]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Feather name={m === "upi" ? "smartphone" : "credit-card"} size={16} color={paymentMethod === m ? "#fff" : colors.foreground} />
                  <Text style={[styles.methodText, { color: paymentMethod === m ? "#fff" : colors.foreground }]}>
                    {m === "upi" ? "UPI" : "Bank Transfer"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {usingSaved && savedPayment && (
              <View style={[styles.savedBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Saved Method
                  </Text>
                  {savedPayment.method === "upi" ? (
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginTop: 2 }}>
                      UPI · {savedPayment.upiId}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginTop: 2 }}>
                      {savedPayment.bankName} · A/C: {savedPayment.accountNumber}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={clearSavedAndReset}
                  style={[styles.changeBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            {paymentMethod === "upi" && (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>Your UPI ID</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="at-sign" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="yourname@upi"
                    placeholderTextColor={colors.mutedForeground}
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </>
            )}

            {paymentMethod === "bank" && (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>Bank Details</Text>

                <TouchableOpacity
                  style={[styles.dropdownBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => { setBankSearch(""); setBankDropdownOpen(true); }}
                >
                  <Feather name="home" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.dropdownText, { color: bankName ? colors.foreground : colors.mutedForeground }]}>
                    {bankName || "Select Bank"}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="hash" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="Account Number"
                    placeholderTextColor={colors.mutedForeground}
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="code" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="IFSC Code (e.g. SBIN0001234)"
                    placeholderTextColor={colors.mutedForeground}
                    value={ifscCode}
                    onChangeText={(t) => setIfscCode(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="Account Holder Name"
                    placeholderTextColor={colors.mutedForeground}
                    value={accountHolderName}
                    onChangeText={setAccountHolderName}
                    autoCapitalize="words"
                  />
                </View>
              </>
            )}

            <View style={[styles.noteBox, { backgroundColor: "#22c55e12", borderColor: "#22c55e40", marginTop: 16 }]}>
              <Feather name="info" size={14} color="#16a34a" />
              <Text style={[styles.noteText, { color: "#15803d" }]}>
                Only your winning amount (₹{winningBalance.toFixed(2)}) can be withdrawn. Deposit balance is used only for joining exams. Winnings are transferred within 24 hours after admin approval.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isFormValid ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={submitting || !isFormValid}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="arrow-up-circle" size={20} color="#fff" />
                  <Text style={styles.submitText}>Withdraw ₹{finalAmount || "—"}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {tab === "history" && (
          <>
            {historyLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : history.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="arrow-up-circle" size={40} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No withdrawal requests yet</Text>
              </View>
            ) : (
              history.map((w) => (
                <View key={w.id} style={[styles.historyCard, {
                  backgroundColor: colors.card,
                  borderColor: w.status === "approved" ? "#BBF7D0" : w.status === "rejected" ? "#FECACA" : colors.border,
                  borderWidth: 1.5,
                }]}>
                  <View style={styles.historyTop}>
                    <View>
                      <Text style={[styles.historyAmount, { color: colors.foreground }]}>
                        ₹{Number(w.amount).toLocaleString("en-IN")}
                      </Text>
                      <Text style={[styles.historyMethod, { color: colors.mutedForeground }]}>
                        via {w.paymentMethod === "upi" ? "UPI" : "Bank Transfer"}
                      </Text>
                    </View>
                    <StatusBadge status={w.status} />
                  </View>

                  <View style={[styles.detailRow, { backgroundColor: colors.secondary, borderRadius: 8, padding: 10, marginTop: 10 }]}>
                    <Feather name={w.paymentMethod === "upi" ? "at-sign" : "credit-card"} size={13} color={colors.mutedForeground} />
                    <Text style={[styles.detailText, { color: colors.mutedForeground }]} numberOfLines={5}>{w.paymentDetails}</Text>
                  </View>

                  {w.status === "approved" && w.adminUtrNumber && (
                    <View style={[styles.utrBox, { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" }]}>
                      <Feather name="check-circle" size={14} color="#065F46" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#065F46" }}>Money Withdrawal Successful</Text>
                        <Text style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>
                          via {w.paymentMethod === "upi" ? "UPI" : "Bank Transfer"} · UTR: <Text style={{ fontWeight: "700" }}>{w.adminUtrNumber}</Text>
                        </Text>
                        {w.adminNote && (
                          <Text style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>{w.adminNote}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {w.status === "rejected" && (
                    <View style={[styles.utrBox, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
                      <Feather name="x-circle" size={14} color="#991B1B" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#991B1B" }}>Withdrawal Rejected — Amount Refunded</Text>
                        {w.adminNote && (
                          <Text style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>Reason: {w.adminNote}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {w.status === "pending" && (
                    <View style={[styles.utrBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                      <Feather name="clock" size={14} color="#92400E" />
                      <Text style={{ fontSize: 12, color: "#92400E" }}>Under review · Processing within 24 hours</Text>
                    </View>
                  )}

                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>{formatDate(w.createdAt)}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={bankDropdownOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Bank</Text>
              <TouchableOpacity onPress={() => setBankDropdownOpen(false)}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border, margin: 16 }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 8 }]}
                placeholder="Search bank..."
                placeholderTextColor={colors.mutedForeground}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.bankItem, { borderBottomColor: colors.border, backgroundColor: bankName === item ? colors.saffronLight : "transparent" }]}
                  onPress={() => { setBankName(item); setBankDropdownOpen(false); }}
                >
                  <Text style={[styles.bankItemText, { color: bankName === item ? colors.saffron : colors.foreground, fontWeight: bankName === item ? "800" : "400" }]}>
                    {item}
                  </Text>
                  {bankName === item && <Feather name="check" size={16} color={colors.saffron} />}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  balancePill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginBottom: 8 },
  balanceText: { fontSize: 14 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 20, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  amountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  amountChip: { width: "30%", paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  amountChipText: { fontSize: 15, fontWeight: "700" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4, gap: 8, marginBottom: 10 },
  rupee: { fontSize: 20, fontWeight: "800" },
  amtInput: { flex: 1, fontSize: 18, fontWeight: "700", paddingVertical: 12 },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  methodRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  methodChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  methodText: { fontSize: 15, fontWeight: "700" },
  savedBanner: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 12, marginBottom: 2, gap: 10 },
  changeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  dropdownBtn: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, gap: 10, marginBottom: 10 },
  dropdownText: { flex: 1, fontSize: 15 },
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  submitText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  historyCard: { borderRadius: 16, padding: 14, marginBottom: 14 },
  historyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyAmount: { fontSize: 22, fontWeight: "900" },
  historyMethod: { fontSize: 12, marginTop: 2 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailText: { flex: 1, fontSize: 12, lineHeight: 17 },
  utrBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1 },
  historyDate: { fontSize: 11, marginTop: 10, textAlign: "right" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12 },
  bankItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  bankItemText: { fontSize: 15 },
  lockScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  lockIconWrap: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  lockTitle: { fontSize: 22, fontWeight: "900", textAlign: "center", lineHeight: 28 },
  lockSub: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 8 },
  lockBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, width: "100%" },
  lockBtnText: { fontSize: 16, fontWeight: "800" },
  lockBtnOutline: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, width: "100%", alignItems: "center" },
  lockBtnOutlineText: { fontSize: 15, fontWeight: "600" },
  reviewNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, width: "100%" },
});
