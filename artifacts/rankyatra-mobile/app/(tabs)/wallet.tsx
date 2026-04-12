import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useGetWalletBalance } from "@workspace/api-client-react";
import { GuestScreen } from "@/components/GuestScreen";

type HistoryTab = "all" | "deposits" | "withdrawals";

interface WalletTransaction {
  id: number;
  amount: string | number;
  type: "credit" | "debit";
  description: string;
  balanceAfter: string | number;
  createdAt: string;
}

interface Deposit {
  id: number;
  amount: string | number;
  utr_number?: string;
  utrNumber?: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

interface Withdrawal {
  id: number;
  amount: string | number;
  bank_name?: string;
  bankName?: string;
  account_number?: string;
  accountNumber?: string;
  utr_number?: string;
  utrNumber?: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:  { bg: "#f59e0b22", text: "#d97706" },
  approved: { bg: "#10b98122", text: "#059669" },
  success:  { bg: "#10b98122", text: "#059669" },
  credited: { bg: "#10b98122", text: "#059669" },
  rejected: { bg: "#ef444422", text: "#dc2626" },
};

function statusStyle(s: string) {
  return STATUS_COLOR[s?.toLowerCase()] ?? { bg: "#6b728022", text: "#6b7280" };
}

function fmtDateTime(raw?: string) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

function getTxIcon(desc: string, type: string): { name: string; color: string; bg: string } {
  const d = desc.toLowerCase();
  if (d.startsWith("prize") || d.includes("reward"))
    return { name: "award", color: "#d97706", bg: "#f59e0b20" };
  if (d.startsWith("exam registration") || d.includes("contest"))
    return { name: "book-open", color: "#ea580c", bg: "#f9731620" };
  if (d.includes("withdrawal") || d.includes("bank"))
    return { name: "arrow-up-circle", color: "#dc2626", bg: "#ef444420" };
  if (d.includes("top-up") || d.includes("deposit"))
    return { name: "arrow-down-circle", color: "#059669", bg: "#10b98120" };
  if (d.includes("admin"))
    return { name: "shield", color: "#2563eb", bg: "#3b82f620" };
  return type === "credit"
    ? { name: "arrow-down-circle", color: "#059669", bg: "#10b98120" }
    : { name: "arrow-up-circle", color: "#dc2626", bg: "#ef444420" };
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser, token } = useAuth();

  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const { data: balance, refetch: refetchBalance, isRefetching } = useGetWalletBalance();

  const [tab, setTab] = useState<HistoryTab>("all");
  const [allTx, setAllTx] = useState<WalletTransaction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoadingAll(true);
    try {
      const res = await fetch(`${baseUrl}/api/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllTx(await res.json());
    } finally {
      setLoadingAll(false);
    }
  }, [token, baseUrl]);

  const fetchDeposits = useCallback(async () => {
    if (!token) return;
    setLoadingDeposits(true);
    try {
      const res = await fetch(`${baseUrl}/api/wallet/deposits/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDeposits(await res.json());
    } finally {
      setLoadingDeposits(false);
    }
  }, [token, baseUrl]);

  const fetchWithdrawals = useCallback(async () => {
    if (!token) return;
    setLoadingWithdrawals(true);
    try {
      const res = await fetch(`${baseUrl}/api/wallet/withdrawals/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setWithdrawals(await res.json());
    } finally {
      setLoadingWithdrawals(false);
    }
  }, [token, baseUrl]);

  useEffect(() => {
    if (user) {
      fetchAll();
      fetchDeposits();
      fetchWithdrawals();
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    const [newBal] = await Promise.all([
      refetchBalance(),
      fetchAll(),
      fetchDeposits(),
      fetchWithdrawals(),
    ]);
    if (newBal?.data) {
      updateUser({ wallet_balance: newBal.data.balance.toString() });
    }
  }, [fetchAll, fetchDeposits, fetchWithdrawals]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refetchBalance();
        fetchAll();
        fetchDeposits();
        fetchWithdrawals();
      }
    }, [user, refetchBalance, fetchAll, fetchDeposits, fetchWithdrawals])
  );

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  if (!user) {
    return (
      <View style={[styles.flex, styles.guestCenter, { backgroundColor: colors.background, paddingTop: topPadding }]}>
        <Image
          source={require("@/assets/images/full-logo.png")}
          style={styles.guestLogo}
          resizeMode="contain"
        />
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
          Log in to view your balance, add money, and track transactions.
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
          <Text style={[styles.guestBtnText, { color: colors.primary }]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoading =
    tab === "all" ? loadingAll :
    tab === "deposits" ? loadingDeposits : loadingWithdrawals;

  const TABS: { key: HistoryTab; icon: string; label: string; count: number }[] = [
    { key: "all",         icon: "list",             label: "All",        count: allTx.length },
    { key: "deposits",    icon: "arrow-down-circle", label: "Deposits",   count: deposits.length },
    { key: "withdrawals", icon: "arrow-up-circle",   label: "Withdrawals",count: withdrawals.length },
  ];

  if (!user) return (
    <GuestScreen
      icon="credit-card"
      title="Your Wallet"
      subtitle="Sign in to add money, withdraw earnings, and view your transaction history"
    />
  );

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Wallet</Text>
      </View>

      {/* Wallet Banner */}
      <View style={[styles.walletBanner, { backgroundColor: colors.secondary, marginHorizontal: 20, marginBottom: 20 }]}>
        <View style={styles.walletLeft}>
          <View style={[styles.walletIconBox, { backgroundColor: "#ffffff18" }]}>
            <Feather name="credit-card" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletAmount}>
              ₹{Number(balance?.balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
        <View style={styles.walletActions}>
          <TouchableOpacity
            style={[styles.walletBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/wallet/deposit")}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.walletBtnText, { color: colors.primaryForeground }]}>Add Money</Text>
          </TouchableOpacity>
          {(() => {
            const isVerified = (user as any)?.verificationStatus === "verified";
            return (
              <TouchableOpacity
                style={[
                  styles.walletBtn,
                  { backgroundColor: isVerified ? "#ffffff18" : "#ef444430", borderWidth: isVerified ? 0 : 1, borderColor: "#ef4444" },
                ]}
                onPress={() => router.push(isVerified ? "/wallet/withdraw" : "/verify")}
              >
                <Feather name={isVerified ? "arrow-up" : "lock"} size={14} color={isVerified ? "#fff" : "#fca5a5"} />
                <Text style={[styles.walletBtnText, { color: isVerified ? "#fff" : "#fca5a5" }]}>
                  {isVerified ? "Withdraw" : "Verify to Withdraw"}
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      </View>

      {/* History Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transaction History</Text>

        {/* 3 Filter Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          {TABS.map(({ key, icon, label, count }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabBtn, tab === key && { backgroundColor: colors.primary }]}
              onPress={() => setTab(key)}
              activeOpacity={0.8}
            >
              <Feather
                name={icon as any}
                size={12}
                color={tab === key ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text style={[styles.tabBtnText, {
                color: tab === key ? colors.primaryForeground : colors.mutedForeground,
              }]}>
                {label}{count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : tab === "all" ? (
          allTx.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clock" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
            </View>
          ) : (
            allTx.map((tx) => {
              const isCredit = tx.type === "credit";
              const txIcon = getTxIcon(tx.description, tx.type);
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.75}
                  onPress={() => router.push({
                    pathname: "/wallet/transaction-detail",
                    params: {
                      type: "tx",
                      id: String(tx.id),
                      amount: String(tx.amount),
                      txType: tx.type,
                      description: tx.description,
                      balanceAfter: String(tx.balanceAfter),
                      createdAt: tx.createdAt,
                    },
                  } as any)}
                >
                  <View style={[styles.txIcon, { backgroundColor: txIcon.bg }]}>
                    <Feather name={txIcon.name as any} size={18} color={txIcon.color} />
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                      {tx.description}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      {fmtDateTime(tx.createdAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={[styles.txAmount, { color: isCredit ? "#059669" : "#dc2626" }]}>
                      {isCredit ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN")}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      Bal: ₹{Number(tx.balanceAfter).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            })
          )
        ) : tab === "deposits" ? (
          deposits.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clock" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No deposits yet</Text>
            </View>
          ) : (
            deposits.map((d) => {
              const st = statusStyle(d.status);
              const utr = d.utrNumber ?? d.utr_number;
              const ts  = d.createdAt ?? d.created_at;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.75}
                  onPress={() => router.push({
                    pathname: "/wallet/transaction-detail",
                    params: {
                      type: "deposit",
                      id: String(d.id),
                      amount: String(d.amount),
                      txType: "credit",
                      utrNumber: utr ?? "",
                      status: d.status,
                      paymentMethod: (d as any).paymentMethod ?? "manual",
                      adminNote: (d as any).adminNote ?? "",
                      createdAt: ts ?? "",
                    },
                  } as any)}
                >
                  <View style={[styles.txIcon, { backgroundColor: "#10b98120" }]}>
                    <Feather name="arrow-down-circle" size={18} color="#059669" />
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                      {(d as any).paymentMethod === "referral_bonus" ? "Referral Bonus" : `Deposit${utr ? ` • UTR: ${utr}` : ""}`}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{fmtDateTime(ts)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[styles.txAmount, { color: "#059669" }]}>
                      +₹{Number(d.amount).toLocaleString("en-IN")}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.text }]}>
                        {d.status === "success" || d.status === "approved" ? "Credited" : d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            })
          )
        ) : (
          withdrawals.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clock" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No withdrawals yet</Text>
            </View>
          ) : (
            withdrawals.map((w) => {
              const st      = statusStyle(w.status);
              const bank    = w.bankName ?? w.bank_name;
              const acct    = w.accountNumber ?? w.account_number;
              const utr     = w.utrNumber ?? w.utr_number;
              const ts      = w.createdAt ?? w.created_at;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.75}
                  onPress={() => router.push({
                    pathname: "/wallet/transaction-detail",
                    params: {
                      type: "withdrawal",
                      id: String(w.id),
                      amount: String(w.amount),
                      txType: "debit",
                      bankName: bank ?? "",
                      accountNumber: acct ?? "",
                      utrNumber: utr ?? "",
                      status: w.status,
                      adminNote: (w as any).adminNote ?? "",
                      createdAt: ts ?? "",
                    },
                  } as any)}
                >
                  <View style={[styles.txIcon, { backgroundColor: "#ef444420" }]}>
                    <Feather name="arrow-up-circle" size={18} color="#dc2626" />
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                      {bank ? `${bank}` : "Withdrawal"}{acct ? ` ••${acct.slice(-4)}` : ""}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      {fmtDateTime(ts)}{utr ? ` • UTR: ${utr}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[styles.txAmount, { color: "#dc2626" }]}>
                      -₹{Number(w.amount).toLocaleString("en-IN")}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.text }]}>
                        {w.status === "success" || w.status === "approved" ? "Transferred" : w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            })
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14 },
  center: { alignItems: "center", paddingVertical: 32 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14 },

  tabRow: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 3,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabBtnText: { fontSize: 11, fontWeight: "700" },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  txMeta: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: "600" },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "800" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },

  walletBanner: { borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  walletIconBox: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  walletLabel: { color: "#ffffff99", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  walletAmount: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 2 },
  walletActions: { gap: 8 },
  walletBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  walletBtnText: { fontSize: 13, fontWeight: "700" },

  guestCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  guestLogo: { width: 200, height: 200, marginBottom: 8 },
  guestSub: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  guestBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, width: "100%", justifyContent: "center" },
  guestBtnOutline: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, width: "100%", justifyContent: "center" },
  guestBtnText: { fontSize: 15, fontWeight: "700" },
});
