import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetExam, useGetLeaderboard, useGetRegistrationStatus, useGetMyResult } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getRankEmoji(rank: number | null) {
  if (!rank) return "—";
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function ResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: exam, isLoading: examLoading } = useGetExam(Number(id));
  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard(Number(id));
  const { data: regStatus, isLoading: regLoading } = useGetRegistrationStatus(Number(id));
  const { data: myResult, isLoading: myResultLoading } = useGetMyResult(Number(id), {
    query: { retry: false, enabled: !!user },
  } as any);

  const entries = (leaderboard ?? []) as any[];
  const isRegistered = (regStatus as any)?.isRegistered ?? (regStatus as any)?.registered ?? false;
  const hasSubmitted = (regStatus as any)?.hasSubmitted ?? false;

  const result = myResult as any;
  const correct = result?.correctAnswers ?? 0;
  const total = result?.totalQuestions ?? 0;
  const wrong = result?.wrongAnswers ?? (total - correct);
  const skipped = result?.skippedAnswers ?? 0;
  const timeTaken = result?.timeTakenSeconds ?? 0;
  const rank = result?.rank ?? null;
  const score = result?.score ?? 0;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const myLbEntry = entries.find((e) => {
    const uid = e.userId ?? e.user_id;
    return uid === user?.id;
  });
  const myRank = rank ?? (myLbEntry
    ? entries.findIndex((e) => (e.userId ?? e.user_id) === user?.id) + 1
    : null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const isLoading = examLoading || lbLoading || regLoading || myResultLoading;

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading results...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/joined")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {hasSubmitted ? "Your Exam Result" : "Leaderboard"}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/profile" as any)}
          style={styles.headerAvatarBtn}
        >
          {user?.avatarUrl ? (
            <Image
              source={{
                uri:
                  user.avatarUrl.startsWith("http") || user.avatarUrl.startsWith("data:")
                    ? user.avatarUrl
                    : `https://${process.env.EXPO_PUBLIC_DOMAIN}${user.avatarUrl}`,
              }}
              style={styles.headerAvatarImg}
              onError={() => {}}
            />
          ) : (
            <View style={[styles.headerAvatarFallback, { backgroundColor: colors.primary }]}>
              <Text style={styles.headerAvatarInitial}>
                {(user?.name ?? "A")[0].toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.examTitle, { color: colors.foreground }]} numberOfLines={2}>
          {exam?.title}
        </Text>

        {/* ─── Personal Result Card ─── */}
        {hasSubmitted && result ? (
          <View style={[styles.resultCard, { backgroundColor: colors.secondary }]}>
            {/* Header row */}
            <View style={styles.resultCardHeader}>
              <View>
                <Text style={styles.resultCardBadge}>EXAM COMPLETE</Text>
                <Text style={styles.resultCardTitle}>
                  {pct >= 80 ? "Excellent! 🎉" : pct >= 60 ? "Good Job! 👍" : pct >= 40 ? "Keep Practicing! 📚" : "Better Luck Next Time 💪"}
                </Text>
              </View>
              <View style={[styles.rankBubble, { backgroundColor: "#ffffff20" }]}>
                <Text style={styles.rankBubbleText}>{getRankEmoji(myRank)}</Text>
                {myRank && myRank > 3 && (
                  <Text style={styles.rankBubbleSub}>Rank</Text>
                )}
              </View>
            </View>

            {/* Score bar */}
            <View style={[styles.scoreBarBg, { backgroundColor: "#ffffff15" }]}>
              <View style={[styles.scoreBarFill, { width: `${pct}%` as any, backgroundColor: pct >= 60 ? "#22c55e" : pct >= 40 ? colors.saffron : "#ef4444" }]} />
            </View>
            <Text style={styles.scoreBarLabel}>{pct}% accuracy</Text>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: "#22c55e20" }]}>
                <Feather name="check-circle" size={20} color="#22c55e" />
                <Text style={[styles.statVal, { color: "#22c55e" }]}>{correct}</Text>
                <Text style={styles.statLbl}>Correct</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: "#ef444420" }]}>
                <Feather name="x-circle" size={20} color="#ef4444" />
                <Text style={[styles.statVal, { color: "#ef4444" }]}>{wrong}</Text>
                <Text style={styles.statLbl}>Wrong</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: "#ffffff15" }]}>
                <Feather name="minus-circle" size={20} color="#ffffff80" />
                <Text style={[styles.statVal, { color: "#fff" }]}>{skipped}</Text>
                <Text style={styles.statLbl}>Skipped</Text>
              </View>
            </View>

            {/* Bottom row: score + time */}
            <View style={styles.bottomRow}>
              <View style={styles.bottomStat}>
                <Feather name="award" size={16} color={colors.saffron} />
                <Text style={[styles.bottomStatVal, { color: colors.saffron }]}>
                  {score} / {total} pts
                </Text>
                <Text style={styles.bottomStatLbl}>Score</Text>
              </View>
              <View style={[styles.bottomDivider, { backgroundColor: "#ffffff20" }]} />
              <View style={styles.bottomStat}>
                <Feather name="clock" size={16} color="#fff" />
                <Text style={[styles.bottomStatVal, { color: "#fff" }]}>
                  {formatTime(timeTaken)}
                </Text>
                <Text style={styles.bottomStatLbl}>Time Taken</Text>
              </View>
              <View style={[styles.bottomDivider, { backgroundColor: "#ffffff20" }]} />
              <View style={styles.bottomStat}>
                <Text style={{ fontSize: 16 }}>🏆</Text>
                <Text style={[styles.bottomStatVal, { color: "#fff" }]}>
                  {myRank ? `#${myRank}` : "—"}
                </Text>
                <Text style={styles.bottomStatLbl}>Your Rank</Text>
              </View>
            </View>
          </View>
        ) : isRegistered && !hasSubmitted ? (
          <View style={[styles.noSubmitBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={18} color={colors.mutedForeground} />
            <Text style={[styles.noSubmitText, { color: colors.mutedForeground }]}>
              You did not submit this exam
            </Text>
          </View>
        ) : !isRegistered ? (
          <View style={[styles.noSubmitBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="info" size={18} color={colors.mutedForeground} />
            <Text style={[styles.noSubmitText, { color: colors.mutedForeground }]}>
              You were not registered for this exam
            </Text>
          </View>
        ) : null}

        {/* ─── Leaderboard ─── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          All Participants ({entries.length})
        </Text>

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="award" size={36} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 8 }}>
              No results yet — be the first!
            </Text>
          </View>
        ) : (
          entries.map((entry, i) => {
            const lbRank = entry.rank ?? i + 1;
            const uid = entry.userId ?? entry.user_id;
            const isMe = uid === user?.id || entry.isCurrentUser;
            const timeTakenEntry = entry.timeTakenSeconds ?? entry.time_taken_seconds ?? 0;
            const name = entry.userName ?? entry.name ?? "Unknown";
            const rawAvatar = entry.avatarUrl ?? entry.avatar_url ?? null;
            const avatar = rawAvatar
              ? rawAvatar.startsWith("http") || rawAvatar.startsWith("data:")
                ? rawAvatar
                : `https://${process.env.EXPO_PUBLIC_DOMAIN}${rawAvatar}`
              : null;
            const entryScore = entry.score ?? 0;
            const entryTotal = entry.totalQuestions ?? total ?? 0;
            const isWinner = lbRank === 1;
            return (
              <View
                key={uid ?? i}
                style={[
                  styles.row,
                  {
                    backgroundColor: isWinner
                      ? "#f9731618"
                      : isMe
                      ? colors.saffronLight
                      : colors.card,
                    borderColor: isWinner
                      ? colors.saffron + "60"
                      : isMe
                      ? colors.saffron + "50"
                      : colors.border,
                    borderWidth: isWinner || isMe ? 1.5 : 1,
                  },
                ]}
              >
                {/* Rank badge */}
                <Text style={[styles.rankText, { color: lbRank <= 3 ? colors.saffron : colors.mutedForeground }]}>
                  {MEDALS[lbRank] ?? `#${lbRank}`}
                </Text>

                {/* Avatar */}
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: isMe ? colors.saffron : colors.secondary }]}>
                    <Text style={styles.avatarInitial}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Name + winner badge */}
                <View style={styles.entryMid}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.entryName, { color: colors.foreground }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {isMe && (
                      <View style={[styles.youBadge, { backgroundColor: colors.saffron }]}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  {isWinner && (
                    <Text style={[styles.winnerTag, { color: colors.saffron }]}>🏆 Winner</Text>
                  )}
                </View>

                {/* Stats */}
                <View style={styles.entryStats}>
                  <Text style={[styles.entryScore, { color: isWinner ? colors.saffron : colors.foreground }]}>
                    {entryScore}{entryTotal > 0 ? `/${entryTotal}` : ""} pts
                  </Text>
                  <Text style={[styles.entryTime, { color: colors.mutedForeground }]}>
                    {formatTime(timeTakenEntry)}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* Home button at bottom */}
        <TouchableOpacity
          style={[styles.homeBottomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/(tabs)/")}
        >
          <Feather name="home" size={18} color={colors.foreground} />
          <Text style={[styles.homeBottomBtnText, { color: colors.foreground }]}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 6 },
  headerAvatarBtn: { padding: 2 },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarInitial: { color: "#fff", fontSize: 16, fontWeight: "800" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  examTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16, lineHeight: 26 },

  resultCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  resultCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  resultCardBadge: { fontSize: 10, fontWeight: "800", color: "#ffffff60", letterSpacing: 1.5, marginBottom: 4 },
  resultCardTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  rankBubble: { borderRadius: 40, padding: 12, alignItems: "center", minWidth: 60 },
  rankBubbleText: { fontSize: 28, textAlign: "center" },
  rankBubbleSub: { fontSize: 10, color: "#ffffff80", textAlign: "center", marginTop: 2 },

  scoreBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 4 },
  scoreBarLabel: { fontSize: 12, color: "#ffffff80", textAlign: "right", marginTop: -4 },

  statsGrid: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 6 },
  statVal: { fontSize: 24, fontWeight: "800" },
  statLbl: { fontSize: 11, color: "#ffffff80", fontWeight: "600" },

  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  bottomStat: { alignItems: "center", gap: 4, flex: 1 },
  bottomStatVal: { fontSize: 16, fontWeight: "800" },
  bottomStatLbl: { fontSize: 10, color: "#ffffff80", fontWeight: "600" },
  bottomDivider: { width: 1, height: 40 },

  noSubmitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  noSubmitText: { fontSize: 14, fontWeight: "600", flex: 1 },

  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  rankText: { width: 32, fontSize: 15, fontWeight: "800", textAlign: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 16, fontWeight: "800" },
  entryMid: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entryName: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  winnerTag: { fontSize: 11, fontWeight: "700" },
  entryStats: { alignItems: "flex-end", gap: 2 },
  entryScore: { fontSize: 13, fontWeight: "800" },
  entryTime: { fontSize: 11 },
  homeBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  homeBottomBtnText: { fontSize: 15, fontWeight: "700" },
});
