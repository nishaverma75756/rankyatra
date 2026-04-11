import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useListExams, useGetMyRegistrations } from "@workspace/api-client-react";
import type { Exam } from "@workspace/api-client-react";
import { ExamCard } from "@/components/ExamCard";
import { GuestScreen } from "@/components/GuestScreen";

function getExamStatus(exam: Exam): "live" | "upcoming" | "ended" {
  const now = Date.now();
  const start = new Date((exam as any).startTime ?? (exam as any).start_time).getTime();
  const end = new Date((exam as any).endTime ?? (exam as any).end_time).getTime();
  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";
  return "ended";
}

type Tab = "upcoming" | "completed";

export default function JoinedExamsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [, setTick] = useState(0);

  // 1-second ticker so countdown timers in ExamCard update live
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: examsData, isLoading: examsLoading, refetch: refetchExams, isRefetching } = useListExams({});
  const { data: regsData, isLoading: regsLoading, refetch: refetchRegs } = useGetMyRegistrations();

  // Auto-refetch whenever this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchExams();
      refetchRegs();
    }, [refetchExams, refetchRegs])
  );

  const onRefresh = useCallback(() => {
    refetchExams();
    refetchRegs();
  }, [refetchExams, refetchRegs]);

  const allExams: Exam[] = (examsData ?? []) as Exam[];

  const registeredExamIds = new Set(
    (regsData ?? []).map((r: any) => r.examId ?? r.exam_id)
  );

  const submittedExamIds = new Set(
    (regsData ?? [])
      .filter((r: any) => r.hasSubmitted)
      .map((r: any) => r.examId ?? r.exam_id)
  );

  const myExams = allExams.filter((e) => registeredExamIds.has(e.id));

  // Completed = exam ended OR user has submitted — sorted most recent first
  const completedTabExams = myExams
    .filter((e) => getExamStatus(e) === "ended" || submittedExamIds.has(e.id))
    .sort((a, b) => {
      const endA = new Date((a as any).endTime ?? (a as any).end_time ?? 0).getTime();
      const endB = new Date((b as any).endTime ?? (b as any).end_time ?? 0).getTime();
      return endB - endA;
    });
  // Upcoming = not ended AND not submitted
  const notCompletedExams = myExams.filter(
    (e) => getExamStatus(e) !== "ended" && !submittedExamIds.has(e.id)
  );
  const liveExams = notCompletedExams.filter((e) => getExamStatus(e) === "live");
  const upcomingExams = notCompletedExams.filter((e) => getExamStatus(e) === "upcoming");
  const upcomingTabExams = [...liveExams, ...upcomingExams];

  const isLoading = examsLoading || regsLoading;

  if (!user) {
    return (
      <View style={[styles.flex, styles.guestCenter, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
        <Image
          source={require("@/assets/images/full-logo.png")}
          style={styles.guestLogo}
          resizeMode="contain"
        />
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
          Sign in to see your registered exams and track your upcoming contests.
        </Text>
        <TouchableOpacity
          style={[styles.guestBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Feather name="log-in" size={18} color="#fff" />
          <Text style={[styles.guestBtnText, { color: "#fff" }]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.guestBtnOutline, { borderColor: colors.primary }]}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text style={[styles.guestBtnText, { color: colors.primary }]}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/(tabs)/")}>
          <Text style={[styles.guestLink, { color: colors.mutedForeground }]}>
            Browse Exams →
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentExams = activeTab === "upcoming" ? upcomingTabExams : completedTabExams;

  if (!user) return (
    <GuestScreen
      icon="book-open"
      title="Your Exams"
      subtitle="Sign in to see the exams you've joined and track your progress"
    />
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Exams</Text>
        {myExams.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>
              {myExams.length}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "upcoming" && [styles.tabActive, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("upcoming")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "upcoming" ? colors.primary : colors.mutedForeground },
            ]}
          >
            My Upcoming
          </Text>
          {upcomingTabExams.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: activeTab === "upcoming" ? colors.primary : colors.muted }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === "upcoming" ? "#fff" : colors.mutedForeground }]}>
                {upcomingTabExams.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "completed" && [styles.tabActive, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab("completed")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "completed" ? colors.primary : colors.mutedForeground },
            ]}
          >
            Completed
          </Text>
          {completedTabExams.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: activeTab === "completed" ? colors.primary : colors.muted }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === "completed" ? "#fff" : colors.mutedForeground }]}>
                {completedTabExams.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : myExams.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="bookmark" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No Exams Joined Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Browse exams and pay ₹5 to join and compete for cash prizes
            </Text>
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/")}
            >
              <Text style={[styles.browseBtnText, { color: colors.primaryForeground }]}>
                Browse Exams
              </Text>
            </TouchableOpacity>
          </View>
        ) : currentExams.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name={activeTab === "upcoming" ? "clock" : "check-circle"} size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {activeTab === "upcoming" ? "No Upcoming Exams" : "No Completed Exams"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {activeTab === "upcoming"
                ? "You have no live or upcoming exams right now"
                : "Exams you've taken will appear here"}
            </Text>
            {activeTab === "upcoming" && (
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/")}
              >
                <Text style={[styles.browseBtnText, { color: colors.primaryForeground }]}>
                  Browse Exams
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : activeTab === "upcoming" ? (
          <>
            {liveExams.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: "#ef4444" }]}>🔴 Live Now</Text>
                {liveExams.map((exam) => {
                  const alreadySubmitted = submittedExamIds.has(exam.id);
                  return (
                    <View
                      key={exam.id}
                      style={[
                        styles.liveCard,
                        alreadySubmitted
                          ? { backgroundColor: "#22c55e10", borderColor: "#22c55e40" }
                          : { backgroundColor: "#ef444410", borderColor: "#ef444440" },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          alreadySubmitted
                            ? router.push(`/exam/${exam.id}/results` as any)
                            : router.push(`/exam/${exam.id}/take` as any)
                        }
                        activeOpacity={0.85}
                      >
                        <View style={styles.liveCardTop}>
                          <View style={styles.livePulseRow}>
                            <View style={[styles.liveDot, alreadySubmitted && { backgroundColor: "#22c55e" }]} />
                            <Text style={[styles.livePillText, alreadySubmitted && { color: "#22c55e" }]}>
                              {alreadySubmitted ? "SUBMITTED" : "LIVE"}
                            </Text>
                          </View>
                          <Text style={[styles.liveCardTitle, { color: colors.foreground }]} numberOfLines={2}>
                            {exam.title}
                          </Text>
                          <Text style={[styles.liveCardSub, { color: colors.mutedForeground }]}>
                            {alreadySubmitted
                              ? "You have submitted this exam"
                              : "Tap to start — exam is live now!"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.liveStartBtn,
                            { backgroundColor: alreadySubmitted ? "#22c55e" : "#ef4444" },
                          ]}
                        >
                          <Feather name={alreadySubmitted ? "bar-chart-2" : "play"} size={16} color="#fff" />
                          <Text style={styles.liveStartBtnText}>
                            {alreadySubmitted ? "Check Your Result" : "Start Exam Now"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {/* Answer Sheet hidden while exam is still LIVE — only shown after exam ends */}
                    </View>
                  );
                })}
              </>
            )}

            {upcomingExams.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.saffron, marginTop: liveExams.length > 0 ? 20 : 0 }]}>
                  ⏰ Upcoming
                </Text>
                {upcomingExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    isRegistered
                    hasSubmitted={submittedExamIds.has(exam.id)}
                    onPress={() => router.push(`/exam/${exam.id}`)}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>✅ Completed Exams</Text>
            {completedTabExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                isRegistered
                hasSubmitted={submittedExamIds.has(exam.id)}
                onPress={() => router.push(`/exam/${exam.id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: { fontSize: 13, fontWeight: "800" },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    marginRight: 28,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabActive: {},
  tabText: { fontSize: 15, fontWeight: "700" },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabBadgeText: { fontSize: 11, fontWeight: "800" },
  center: { paddingVertical: 80, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  browseBtnText: { fontSize: 15, fontWeight: "700" },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 12,
    textTransform: "uppercase",
  },
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
  guestLink: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  liveCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  liveCardTop: { gap: 6 },
  livePulseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  livePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 1,
  },
  liveCardTitle: { fontSize: 17, fontWeight: "800", lineHeight: 22 },
  liveCardSub: { fontSize: 13 },
  liveStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  liveStartBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
