import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { showAlert, showSuccess, showError, showConfirm } from "@/utils/alert";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetExam,
  useGetRegistrationStatus,
  registerForExam,
} from "@workspace/api-client-react";

function getExamStatus(startTime: string, endTime: string) {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "ended";
}

export default function ExamDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, updateUser } = useAuth();
  const [registering, setRegistering] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const { data: exam, isLoading } = useGetExam(Number(id), { query: { refetchInterval: 15000 } } as any);
  const { data: regStatus, refetch: refetchReg } = useGetRegistrationStatus(Number(id), { query: { refetchInterval: 15000 } } as any);

  const raw = exam as any;
  const startTime: string = raw?.startTime ?? raw?.start_time ?? "";
  const endTime: string = raw?.endTime ?? raw?.end_time ?? "";
  const entryFee = raw?.entryFee ?? raw?.entry_fee ?? 0;
  const prizePool = raw?.prizePool ?? raw?.prize_pool ?? 0;

  const status = startTime && endTime ? getExamStatus(startTime, endTime) : "upcoming";
  const isRegistered = (regStatus as any)?.isRegistered ?? (regStatus as any)?.registered ?? false;
  const hasSubmitted = (regStatus as any)?.hasSubmitted ?? false;
  const canTakeExam = isRegistered && status === "live" && !hasSubmitted;

  const handleRegister = useCallback(async () => {
    if (!user) {
      showAlert(
        "Login Required",
        "You need to sign in to join this contest. Create a free account or sign in to compete and win prizes!",
        [
          { text: "Sign In", onPress: () => router.push("/(auth)/login") },
          { text: "Sign Up Free", onPress: () => router.push("/(auth)/signup") },
          { text: "Cancel", style: "cancel" },
        ],
        "warning"
      );
      return;
    }
    const fee = Number(entryFee ?? 5);
    const balance = Number(user?.walletBalance ?? user?.wallet_balance ?? 0);
    if (balance < fee) {
      showAlert(
        "Insufficient Balance",
        `You need ₹${fee} to join. Your current wallet balance is ₹${balance}. Please add money first.`,
        [
          { text: "Add Money", onPress: () => router.push("/(tabs)/wallet") },
          { text: "Cancel", style: "cancel" },
        ],
        "warning"
      );
      return;
    }
    showConfirm(
      "Confirm & Pay ₹" + fee,
      `Join "${exam?.title}" for ₹${fee}?\n\nThis amount will be deducted from your wallet.`,
      async () => {
        setRegistering(true);
        try {
          await registerForExam(Number(id));
          updateUser({ walletBalance: balance - fee });
          await refetchReg();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess("Registered! 🎉", "You're all set. Best of luck in the exam!");
        } catch (e: any) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showError("Registration Failed", e?.response?.data?.message ?? e?.message ?? "Registration failed. Please try again.");
        } finally {
          setRegistering(false);
        }
      },
      "Confirm & Pay",
      "Cancel"
    );
  }, [exam, user, id, entryFee]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!exam) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Exam not found.</Text>
      </View>
    );
  }

  const startDate = startTime ? new Date(startTime) : null;
  const dateStr = startDate && !isNaN(startDate.getTime())
    ? startDate.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>
          Exam Details
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusPill, {
          backgroundColor:
            status === "live" ? "#22c55e20" :
            status === "ended" ? colors.muted :
            colors.saffronLight
        }]}>
          {status === "live" && <View style={[styles.liveDot, { backgroundColor: "#22c55e" }]} />}
          <Text style={{
            color:
              status === "live" ? "#22c55e" :
              status === "ended" ? colors.mutedForeground :
              colors.saffron,
            fontWeight: "700", fontSize: 12
          }}>
            {status === "live" ? "LIVE NOW" : status === "ended" ? "ENDED" : "UPCOMING"}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{exam.title}</Text>

        <View style={styles.metaGrid}>
          <MetaItem icon="tag" label="Category" value={exam.category ?? "-"} colors={colors} />
          <MetaItem icon="clock" label="Duration" value="20 minutes" colors={colors} />
          <MetaItem icon="dollar-sign" label="Entry Fee" value={`₹${entryFee}`} colors={colors} />
          <MetaItem icon="award" label="Prize Pool" value={`₹${Number(prizePool).toLocaleString("en-IN")}`} colors={colors} highlight />
          <MetaItem icon="calendar" label="Date & Time" value={dateStr} colors={colors} wide />
        </View>

        {isRegistered && (
          <View style={[styles.joinedCard, {
            backgroundColor: status === "live" ? "#22c55e18" : status === "ended" ? colors.muted : "#22c55e12",
            borderColor: status === "live" ? "#22c55e50" : status === "ended" ? colors.border : "#22c55e30",
          }]}>
            <View style={styles.joinedCardTop}>
              <View style={[styles.joinedIconCircle, {
                backgroundColor: status === "live" ? "#22c55e" : status === "ended" ? colors.mutedForeground : "#22c55e",
              }]}>
                <Feather name={status === "ended" ? "award" : "check"} size={18} color="#fff" />
              </View>
              <View style={styles.joinedCardText}>
                <Text style={[styles.joinedCardTitle, {
                  color: status === "ended" ? colors.foreground : "#22c55e",
                }]}>
                  {status === "live" ? "You're registered — Exam is LIVE!" :
                   status === "ended" ? "You participated in this exam" :
                   "You have already joined this exam"}
                </Text>
                <Text style={[styles.joinedCardSub, { color: colors.mutedForeground }]}>
                  {status === "live" ? "Tap 'Start Exam Now' below to begin" :
                   status === "ended" ? "Check the leaderboard to see your rank" :
                   "Sit tight — exam starts soon!"}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.rulesCard, { backgroundColor: colors.saffronLight, borderColor: colors.saffron + "40" }]}>
          <Text style={[styles.rulesTitle, { color: colors.saffron }]}>Rules</Text>
          {[
            `Pay ₹${entryFee} entry fee from your wallet`,
            "20-minute timed exam with MCQ questions",
            "Highest score wins; tie-breaker: lowest time",
            "Solutions revealed after exam ends",
            "Prize credited to wallet automatically",
          ].map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <Feather name="check-circle" size={14} color={colors.saffron} />
              <Text style={[styles.ruleText, { color: colors.foreground }]}>{rule}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, {
        paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16),
        backgroundColor: colors.background,
        borderTopColor: colors.border,
      }]}>
        {status === "ended" ? (
          isRegistered && hasSubmitted ? (
            <View style={styles.btnStack}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.secondary }]}
                onPress={() => router.push(`/exam/${id}/results`)}
              >
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>Check Your Exam Result</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#7c3aed" }]}
                onPress={() => router.push(`/exam/${id}/answer-sheet` as any)}
              >
                <Feather name="list" size={18} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>See Right Answer Sheet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.secondary }]}
              onPress={() => router.push(`/exam/${id}/results`)}
            >
              <Feather name="bar-chart-2" size={18} color="#fff" />
              <Text style={[styles.btnText, { color: "#fff" }]}>View Leaderboard</Text>
            </TouchableOpacity>
          )
        ) : status === "live" ? (
          isRegistered ? (
            hasSubmitted ? (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.secondary }]}
                onPress={() => router.push(`/exam/${id}/results`)}
              >
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>Check Your Exam Result</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#22c55e" }]}
                onPress={() => router.push(`/exam/${id}/take`)}
              >
                <Feather name="play" size={18} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>Start Exam Now</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={[styles.btn, { backgroundColor: colors.muted }]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>
                Registration closed — Exam is Live
              </Text>
            </View>
          )
        ) : isRegistered ? (
          <View style={styles.alreadyJoinedBlock}>
            <View style={[styles.alreadyJoinedRow, { backgroundColor: "#22c55e12", borderColor: "#22c55e30" }]}>
              <Feather name="check-circle" size={20} color="#22c55e" />
              <View style={styles.alreadyJoinedText}>
                <Text style={[styles.alreadyJoinedTitle, { color: "#22c55e" }]}>
                  You are already joined
                </Text>
                <Text style={[styles.alreadyJoinedSub, { color: colors.mutedForeground }]}>
                  Sit tight — exam starts soon!
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.muted }]}
              onPress={() => router.back()}
            >
              <Feather name="compass" size={18} color={colors.mutedForeground} />
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>
                Explore Other Exams
              </Text>
            </TouchableOpacity>
          </View>
        ) : !user ? (
          <View style={styles.loginToJoinWrap}>
            <View style={[styles.loginToJoinHint, { backgroundColor: colors.saffronLight }]}>
              <Feather name="lock" size={14} color={colors.saffron} />
              <Text style={[styles.loginToJoinHintText, { color: colors.saffron }]}>
                Login required to join this exam
              </Text>
            </View>
            <View style={styles.loginToJoinRow}>
              <TouchableOpacity
                style={[styles.btn, { flex: 1, backgroundColor: colors.primary }]}
                onPress={() => router.push("/(auth)/login")}
              >
                <Feather name="log-in" size={18} color={colors.primaryForeground} />
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                  Login to Join
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOutline, { borderColor: colors.primary }]}
                onPress={() => router.push("/(auth)/signup")}
              >
                <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary, opacity: registering ? 0.7 : 1 }]}
            onPress={handleRegister}
            disabled={registering}
          >
            {registering ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="zap" size={18} color={colors.primaryForeground} />
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                  Join for ₹{entryFee}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MetaItem({ icon, label, value, colors, highlight, wide }: any) {
  return (
    <View style={[
      styles.metaItem,
      wide && styles.metaItemWide,
      { backgroundColor: highlight ? colors.saffronLight : colors.card, borderColor: highlight ? colors.saffron + "40" : colors.border }
    ]}>
      <Feather name={icon} size={16} color={highlight ? colors.saffron : colors.mutedForeground} />
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: highlight ? colors.saffron : colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 6 },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    marginBottom: 12,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 20, lineHeight: 28 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  metaItem: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  metaItemWide: { minWidth: "100%", flex: 0 },
  metaLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  metaValue: { fontSize: 15, fontWeight: "700" },
  joinedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  joinedCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  joinedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  joinedCardText: { flex: 1 },
  joinedCardTitle: { fontSize: 15, fontWeight: "800" },
  joinedCardSub: { fontSize: 12, marginTop: 2 },
  rulesCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  rulesTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  ruleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  ruleText: { fontSize: 13, flex: 1, lineHeight: 18 },
  footer: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  btnStack: { gap: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  btnText: { fontSize: 16, fontWeight: "800" },
  alreadyJoinedBlock: { gap: 10 },
  alreadyJoinedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  alreadyJoinedText: { flex: 1 },
  alreadyJoinedTitle: { fontSize: 15, fontWeight: "800" },
  alreadyJoinedSub: { fontSize: 12, marginTop: 2 },
  loginToJoinWrap: { gap: 10 },
  loginToJoinHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  loginToJoinHintText: { fontSize: 13, fontWeight: "600" },
  loginToJoinRow: { flexDirection: "row", gap: 10 },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  btnOutlineText: { fontSize: 15, fontWeight: "700" },
});
