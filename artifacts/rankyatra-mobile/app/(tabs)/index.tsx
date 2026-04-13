import React, { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { ExamCard } from "@/components/ExamCard";
import { useListExams, useGetMyRegistrations, useGetMe } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import type { Exam } from "@workspace/api-client-react";

type Banner = {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  bgFrom: string;
  bgTo: string;
  linkUrl: string;
  linkLabel: string;
  imageUrl?: string | null;
  displayOrder: number;
};

const DEFAULT_BANNER: Banner = {
  id: 0, title: "Win Real Cash Prizes", subtitle: "Pay ₹5 · Compete for ₹50,000+",
  emoji: "⚡", bgFrom: "#f97316", bgTo: "#ea580c", linkUrl: "/", linkLabel: "Join Now", displayOrder: 0,
};

function BannerSlider({ liveCount }: { liveCount: number }) {
  const colors = useColors();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const { data: fetchedBanners = [] } = useQuery<Banner[]>({
    queryKey: ["banners"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/banners`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const slides = fetchedBanners.length > 0 ? fetchedBanners : [DEFAULT_BANNER];

  useEffect(() => {
    if (current >= slides.length) setCurrent(0);
  }, [slides.length, current]);

  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length]);

  const slide = slides[Math.min(current, slides.length - 1)] ?? DEFAULT_BANNER;

  return (
    <View style={styles.bannerContainer}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push("/(tabs)/")}
        style={styles.bannerCard}
      >
        {slide.imageUrl ? (
          /* ── Image Banner ── */
          <Image
            source={{ uri: slide.imageUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          /* ── Text / Gradient Banner ── */
          <View style={[styles.bannerGradient, { backgroundColor: slide.bgFrom }]}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerEmoji}>{slide.emoji}</Text>
              <View style={styles.bannerTextBlock}>
                <Text style={styles.bannerTitle}>{slide.title}</Text>
                <Text style={styles.bannerSub}>{slide.subtitle}</Text>
              </View>
              {liveCount > 0 && (
                <View style={styles.liveAlert}>
                  <Text style={styles.liveAlertText}>{liveCount} LIVE</Text>
                </View>
              )}
            </View>
          </View>
        )}
        {slides.length > 1 && (
          <View style={styles.dotRow}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === current ? "#fff" : "#ffffff55" }]}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const STATUS_TABS = ["All Upcoming", "Live", "Ended"] as const;
type StatusTab = typeof STATUS_TABS[number];

function getExamStatus(exam: Exam): "live" | "upcoming" | "ended" {
  const now = Date.now();
  const start = new Date((exam as any).start_time ?? (exam as any).startTime).getTime();
  const end = new Date((exam as any).end_time ?? (exam as any).endTime).getTime();
  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";
  return "ended";
}

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<StatusTab>("All Upcoming");
  const [, setTick] = useState(0);
  const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: meData } = useGetMe();
  useEffect(() => {
    if (meData && (meData as any).walletBalance !== undefined) {
      updateUser({ walletBalance: (meData as any).walletBalance });
    }
  }, [meData]);

  // Dynamic categories from API — returns plain string array
  const { data: fetchedCats = [] } = useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/categories`);
      return r.json();
    },
    staleTime: 60_000,
  });
  const CATEGORIES = ["All", ...fetchedCats];

  const { data: examsData, isLoading, refetch, isRefetching } = useListExams(
    selectedCategory !== "All" ? { category: selectedCategory } : {}
  );

  const { data: regsData, refetch: refetchRegs } = useGetMyRegistrations();

  // Refetch registrations every time this screen comes into focus
  // so that "Joined" badge updates immediately after user registers for an exam
  useFocusEffect(
    useCallback(() => {
      refetchRegs();
    }, [refetchRegs])
  );

  const registeredExamIds = new Set(
    (regsData ?? []).map((r: any) => r.examId ?? r.exam_id)
  );

  const submittedExamIds = new Set(
    (regsData ?? []).filter((r: any) => r.hasSubmitted).map((r: any) => r.examId ?? r.exam_id)
  );

  const allExams: Exam[] = (examsData ?? []) as Exam[];

  const getStartMs = (e: Exam) => new Date((e as any).startTime ?? (e as any).start_time ?? 0).getTime();
  const getEndMs = (e: Exam) => new Date((e as any).endTime ?? (e as any).end_time ?? 0).getTime();
  const sortAsc = (a: Exam, b: Exam) => getStartMs(a) - getStartMs(b);
  const sortDesc = (a: Exam, b: Exam) => getStartMs(b) - getStartMs(a);
  const sortEndedDesc = (a: Exam, b: Exam) => getEndMs(b) - getEndMs(a);
  const sortByStatusThenTime = (a: Exam, b: Exam) => {
    const order: Record<string, number> = { live: 0, upcoming: 1, ended: 2 };
    const as = getExamStatus(a), bs = getExamStatus(b);
    if (as !== bs) return order[as] - order[bs];
    return getStartMs(a) - getStartMs(b);
  };

  const myExams = allExams.filter((e) => registeredExamIds.has(e.id) && getExamStatus(e) !== "ended").sort(sortByStatusThenTime);

  const filteredExams = selectedStatus === "All Upcoming"
    ? allExams.filter((e) => getExamStatus(e) === "upcoming").sort(sortAsc)
    : selectedStatus === "Ended"
      ? allExams.filter((e) => getExamStatus(e) === "ended").sort(sortEndedDesc)
      : selectedStatus === "Live"
        ? allExams.filter((e) => getExamStatus(e) === "live").sort(sortDesc)
        : allExams.filter((e) => getExamStatus(e) === selectedStatus.toLowerCase() as "live" | "ended").sort(sortAsc);

  const liveCount = allExams.filter((e) => getExamStatus(e) === "live").length;
  const upcomingCount = allExams.filter((e) => getExamStatus(e) === "upcoming").length;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const getStatusTabCount = (tab: StatusTab) => {
    if (tab === "All Upcoming") return allExams.filter((e) => getExamStatus(e) === "upcoming").length;
    return allExams.filter((e) => getExamStatus(e) === tab.toLowerCase()).length;
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 80 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
      >
        {/* Header */}
        {user ? (
          <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
            <View>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
                Welcome back,
              </Text>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {user.name?.split(" ")[0] ?? "Aspirant"} 👋
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.walletChip, { backgroundColor: colors.saffronLight }]}
                onPress={() => router.push("/(tabs)/wallet")}
              >
                <Feather name="credit-card" size={14} color={colors.saffron} />
                <Text style={[styles.walletText, { color: colors.saffron }]}>
                  ₹{Number(user.walletBalance ?? 0).toLocaleString("en-IN")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={styles.headerAvatar}>
                {user.avatarUrl ? (
                  <Image
                    source={{
                      uri:
                        user.avatarUrl.startsWith("http") || user.avatarUrl.startsWith("data:")
                          ? user.avatarUrl
                          : `https://${process.env.EXPO_PUBLIC_DOMAIN}${user.avatarUrl}`,
                    }}
                    style={styles.headerAvatarImage}
                    onError={() => {}}
                  />
                ) : (
                  <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.headerAvatarInitial}>
                      {(user.name ?? "A")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.guestHeader, { paddingTop: topPadding + 16 }]}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.guestLogo}
              resizeMode="contain"
            />
            <View style={styles.guestAuthRow}>
              <TouchableOpacity
                style={[styles.guestSignIn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(auth)/login")}
              >
                <Text style={[styles.guestSignInText, { color: colors.primaryForeground }]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.guestSignUp, { borderColor: colors.primary }]}
                onPress={() => router.push("/(auth)/signup")}
              >
                <Text style={[styles.guestSignUpText, { color: colors.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Hero Banner — dynamic from admin */}
        <BannerSlider liveCount={liveCount} />

        {/* Your Exams section */}
        {selectedCategory === "All" && myExams.length > 0 && (
          <View style={styles.myExamsSection}>
            <View style={styles.myExamsTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Your Exams
              </Text>
              <View style={[styles.myExamsBadge, { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.myExamsBadgeText, { color: colors.primary }]}>
                  {myExams.length}
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {myExams.map((exam) => {
                const status = getExamStatus(exam);
                const statusColor =
                  status === "live" ? "#ef4444" : status === "upcoming" ? colors.saffron : colors.mutedForeground;
                const startTime = new Date((exam as any).startTime ?? (exam as any).start_time);
                const timeLabel =
                  status === "live"
                    ? "LIVE NOW"
                    : status === "upcoming"
                    ? startTime.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
                      " · " +
                      startTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "Ended";

                return (
                  <TouchableOpacity
                    key={exam.id}
                    style={[styles.myExamCard, { backgroundColor: colors.card, borderColor: status === "live" ? "#ef444430" : colors.border }]}
                    onPress={() => router.push(`/exam/${exam.id}`)}
                    activeOpacity={0.8}
                  >
                    {status === "live" && (
                      <View style={styles.liveChipRow}>
                        <PulsingDot color="#ef4444" />
                        <Text style={styles.liveChipText}>LIVE</Text>
                      </View>
                    )}
                    <Text style={[styles.myExamTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {exam.title}
                    </Text>
                    <Text style={[styles.myExamCategory, { color: colors.mutedForeground }]}>
                      {(exam as any).category}
                    </Text>
                    <View style={styles.myExamFooter}>
                      <View style={[styles.myExamStatusDot, { backgroundColor: statusColor + "20" }]}>
                        <Text style={[styles.myExamStatusText, { color: statusColor }]} numberOfLines={1}>
                          {timeLabel}
                        </Text>
                      </View>
                      {status === "live" && (
                        <View style={[styles.goBtn, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.goBtnText, { color: colors.primaryForeground }]}>Start →</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Section title */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Browse Exams
          </Text>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catChip,
                {
                  backgroundColor:
                    selectedCategory === cat ? colors.primary : colors.muted,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.catText,
                  {
                    color:
                      selectedCategory === cat
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    fontWeight: selectedCategory === cat ? "700" : "500",
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status tabs — Live / Upcoming / Ended */}
        <View style={[styles.statusTabRow, { borderBottomColor: colors.border }]}>
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab;
            const count = getStatusTabCount(tab);
            const isLiveTab = tab === "Live";
            const tabColor = isLiveTab ? "#ef4444" : tab === "All Upcoming" ? colors.saffron : colors.mutedForeground;

            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.statusTab,
                  isActive && {
                    borderBottomWidth: 2.5,
                    borderBottomColor: isLiveTab ? "#ef4444" : colors.primary,
                  },
                ]}
                onPress={() => setSelectedStatus(tab)}
              >
                <View style={styles.statusTabInner}>
                  {isLiveTab && liveCount > 0 && (
                    <PulsingDot color="#ef4444" />
                  )}
                  <Text
                    style={[
                      styles.statusTabText,
                      {
                        color: isActive
                          ? isLiveTab ? "#ef4444" : colors.primary
                          : colors.mutedForeground,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {tab}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.tabCount,
                        {
                          backgroundColor: isActive
                            ? isLiveTab ? "#ef444422" : colors.primary + "20"
                            : colors.muted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountText,
                          {
                            color: isActive
                              ? isLiveTab ? "#ef4444" : colors.primary
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Exam list */}
        <View style={styles.examList}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : filteredExams.length === 0 ? (
            <View style={styles.empty}>
              <Feather
                name={selectedStatus === "Live" ? "radio" : selectedStatus === "All Upcoming" ? "clock" : "archive"}
                size={40}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {selectedStatus === "Live"
                  ? "No Live Exams Right Now"
                  : selectedStatus === "All Upcoming"
                  ? "No Upcoming Exams"
                  : "No Ended Exams"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {selectedStatus === "Live"
                  ? "Check All Upcoming tab to see what's next"
                  : selectedStatus === "All Upcoming"
                  ? "New exams are added regularly"
                  : "Try a different category filter"}
              </Text>
            </View>
          ) : (
            filteredExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                isRegistered={registeredExamIds.has(exam.id)}
                hasSubmitted={submittedExamIds.has(exam.id)}
                onPress={() => router.push(`/exam/${exam.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  greeting: { fontSize: 14, fontWeight: "500" },
  userName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  walletText: { fontSize: 14, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 36, height: 36 },
  headerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarInitial: { color: "#fff", fontSize: 15, fontWeight: "800" },
  bannerContainer: { paddingHorizontal: 20, marginBottom: 24 },
  bannerCard: {
    borderRadius: 20,
    height: 112,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  bannerGradient: {
    flex: 1,
    justifyContent: "center",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
    flex: 1,
  },
  bannerEmoji: { fontSize: 28 },
  bannerTextBlock: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  bannerSub: { fontSize: 12, color: "#ffffff99", marginTop: 2 },
  liveAlert: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveAlertText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dotRow: {
    position: "absolute",  // absolute so dots don't add height
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  section: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  categories: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  catText: { fontSize: 13 },
  statusTabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  statusTab: {
    flex: 1,
    paddingBottom: 10,
    alignItems: "center",
  },
  statusTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusTabText: {
    fontSize: 13,
  },
  tabCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: "700",
  },
  guestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  guestLogo: { height: 40, width: 168, marginLeft: -20 },
  guestAuthRow: { flexDirection: "row", gap: 8 },
  guestSignIn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  guestSignInText: { fontSize: 13, fontWeight: "700" },
  guestSignUp: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  guestSignUpText: { fontSize: 13, fontWeight: "700" },
  examList: { paddingHorizontal: 20 },
  center: { paddingVertical: 40, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  emptyText: { fontSize: 13, textAlign: "center", paddingHorizontal: 20 },
  myExamsSection: { marginBottom: 24 },
  myExamsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  myExamsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  myExamsBadgeText: { fontSize: 12, fontWeight: "800" },
  myExamCard: {
    width: 200,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  liveChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  liveChipText: { fontSize: 10, fontWeight: "800", color: "#ef4444", letterSpacing: 0.5 },
  myExamTitle: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  myExamCategory: { fontSize: 11, fontWeight: "600" },
  myExamFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 4,
  },
  myExamStatusDot: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flex: 1,
  },
  myExamStatusText: { fontSize: 10, fontWeight: "700" },
  goBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  goBtnText: { fontSize: 11, fontWeight: "800" },
});
