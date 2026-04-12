import React, { useRef, useState } from "react";
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
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { showError } from "@/utils/alert";

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
  const shareCardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

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
  const pctColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";

  const myLbEntry = entries.find((e) => {
    const uid = e.userId ?? e.user_id;
    return uid === user?.id;
  });
  const myRank = rank ?? (myLbEntry
    ? entries.findIndex((e) => (e.userId ?? e.user_id) === user?.id) + 1
    : null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const isLoading = examLoading || lbLoading || regLoading || myResultLoading;

  const handleShareResult = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share My Exam Result",
        });
      } else {
        showError("Sharing not available on this device.");
      }
    } catch {
      showError("Could not generate result image. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading results...</Text>
      </View>
    );
  }

  const perfMsg = pct >= 80 ? "Excellent performance! Keep it up!" : pct >= 60 ? "Good job!" : pct >= 40 ? "Keep practicing!" : "Don't give up!";
  const perfEmoji = pct >= 80 ? "🎯" : pct >= 60 ? "👍" : pct >= 40 ? "📚" : "💪";

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/joined")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {hasSubmitted ? "Your Exam Result" : "Leaderboard"}
        </Text>
        {hasSubmitted && result ? (
          <TouchableOpacity onPress={handleShareResult} style={styles.shareHeaderBtn} disabled={sharing}>
            {sharing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="share-2" size={20} color={colors.primary} />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/profile" as any)}
            style={styles.headerAvatarBtn}
          >
            {user?.avatarUrl ? (
              <Image
                source={{
                  uri: user.avatarUrl.startsWith("http") || user.avatarUrl.startsWith("data:")
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
        )}
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
          <>
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

            {/* Share Result Button */}
            <TouchableOpacity
              style={[styles.shareBtn, { borderColor: colors.primary }]}
              onPress={handleShareResult}
              disabled={sharing}
              activeOpacity={0.8}
            >
              {sharing
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name="share-2" size={16} color={colors.primary} />}
              <Text style={[styles.shareBtnText, { color: colors.primary }]}>
                {sharing ? "Generating image..." : "Share My Result"}
              </Text>
            </TouchableOpacity>
          </>
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
                    backgroundColor: isWinner ? "#f9731618" : isMe ? colors.saffronLight : colors.card,
                    borderColor: isWinner ? colors.saffron + "60" : isMe ? colors.saffron + "50" : colors.border,
                    borderWidth: isWinner || isMe ? 1.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.rankText, { color: lbRank <= 3 ? colors.saffron : colors.mutedForeground }]}>
                  {MEDALS[lbRank] ?? `#${lbRank}`}
                </Text>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: isMe ? colors.saffron : colors.secondary }]}>
                    <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.entryMid}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.entryName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
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

        <TouchableOpacity
          style={[styles.homeBottomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/(tabs)/")}
        >
          <Feather name="home" size={18} color={colors.foreground} />
          <Text style={[styles.homeBottomBtnText, { color: colors.foreground }]}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Off-screen shareable result card */}
      {hasSubmitted && result && (
        <View style={styles.offScreen} pointerEvents="none">
          <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
            <ShareResultCard
              examTitle={exam?.title ?? ""}
              examCategory={(exam as any)?.category ?? ""}
              pct={pct}
              pctColor={pctColor}
              score={score}
              total={total}
              correct={correct}
              wrong={wrong}
              skipped={skipped}
              timeTaken={timeTaken}
              myRank={myRank}
              perfMsg={perfMsg}
              perfEmoji={perfEmoji}
              userName={user?.name}
            />
          </ViewShot>
        </View>
      )}
    </View>
  );
}

function ShareResultCard({
  examTitle, examCategory, pct, pctColor, score, total,
  correct, wrong, skipped, timeTaken, myRank, perfMsg, perfEmoji, userName,
}: {
  examTitle: string; examCategory: string; pct: number; pctColor: string;
  score: number; total: number; correct: number; wrong: number; skipped: number;
  timeTaken: number; myRank: number | null; perfMsg: string; perfEmoji: string; userName?: string;
}) {
  const accentColor = "#f97316";
  const isTop3 = myRank !== null && myRank <= 3;
  const medal = myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : null;
  const rankLabel = medal ?? (myRank ? `#${myRank}` : "—");

  return (
    <View style={[shareStyles.card, { backgroundColor: isTop3 ? "#1a0a00" : "#0f172a" }]}>
      <View style={shareStyles.cardHeader}>
        <View style={shareStyles.brandRow}>
          <View style={[shareStyles.brandDot, { backgroundColor: accentColor }]} />
          <Text style={[shareStyles.brandName, { color: accentColor }]}>RankYatra</Text>
        </View>
        <Text style={shareStyles.cardLabel}>EXAM RESULT</Text>
      </View>

      <View style={[shareStyles.examBlock, { borderColor: "#ffffff15" }]}>
        {examCategory ? (
          <View style={[shareStyles.catBadge, { backgroundColor: accentColor + "30" }]}>
            <Text style={[shareStyles.catBadgeText, { color: accentColor }]}>{examCategory}</Text>
          </View>
        ) : null}
        <Text style={shareStyles.examTitleText} numberOfLines={2}>{examTitle}</Text>
      </View>

      <View style={shareStyles.heroRow}>
        <View style={[shareStyles.heroBox, { backgroundColor: "#ffffff08", borderColor: "#ffffff15" }]}>
          <Text style={shareStyles.heroEmoji}>{medal ?? "🏅"}</Text>
          <Text style={[shareStyles.heroVal, { color: isTop3 ? "#fbbf24" : "#fff" }]}>{rankLabel}</Text>
          <Text style={shareStyles.heroLbl}>Your Rank</Text>
        </View>
        <View style={[shareStyles.heroDivider, { backgroundColor: "#ffffff20" }]} />
        <View style={[shareStyles.heroBox, { backgroundColor: "#ffffff08", borderColor: "#ffffff15" }]}>
          <View style={[shareStyles.pctCircle, { borderColor: pctColor }]}>
            <Text style={[shareStyles.pctText, { color: pctColor }]}>{pct}%</Text>
          </View>
          <Text style={[shareStyles.heroVal, { color: "#fff" }]}>{score}/{total} pts</Text>
          <Text style={shareStyles.heroLbl}>Score</Text>
        </View>
      </View>

      <View style={shareStyles.statsRow}>
        <View style={[shareStyles.statPill, { backgroundColor: "#22c55e18" }]}>
          <Text style={shareStyles.statPillIcon}>✅</Text>
          <Text style={[shareStyles.statPillVal, { color: "#22c55e" }]}>{correct}</Text>
          <Text style={shareStyles.statPillLbl}>Correct</Text>
        </View>
        <View style={[shareStyles.statPill, { backgroundColor: "#ef444418" }]}>
          <Text style={shareStyles.statPillIcon}>❌</Text>
          <Text style={[shareStyles.statPillVal, { color: "#ef4444" }]}>{wrong}</Text>
          <Text style={shareStyles.statPillLbl}>Wrong</Text>
        </View>
        <View style={[shareStyles.statPill, { backgroundColor: "#ffffff10" }]}>
          <Text style={shareStyles.statPillIcon}>⏭</Text>
          <Text style={[shareStyles.statPillVal, { color: "#94a3b8" }]}>{skipped}</Text>
          <Text style={shareStyles.statPillLbl}>Skipped</Text>
        </View>
        <View style={[shareStyles.statPill, { backgroundColor: "#6b728018" }]}>
          <Text style={shareStyles.statPillIcon}>⏱</Text>
          <Text style={[shareStyles.statPillVal, { color: "#a78bfa" }]}>
            {timeTaken > 0 ? `${Math.floor(timeTaken / 60)}m` : "—"}
          </Text>
          <Text style={shareStyles.statPillLbl}>Time</Text>
        </View>
      </View>

      <View style={[shareStyles.perfRow, { backgroundColor: pctColor + "20", borderColor: pctColor + "40" }]}>
        <Text style={shareStyles.perfEmoji}>{perfEmoji}</Text>
        <Text style={[shareStyles.perfMsg, { color: pctColor }]} numberOfLines={2}>{perfMsg}</Text>
      </View>

      <View style={shareStyles.footer}>
        <Text style={[shareStyles.footerTag, { color: "#ffffff40" }]}>
          {userName ? `${userName} on ` : ""}
          <Text style={{ color: accentColor, fontWeight: "800" }}>rankyatra.in</Text>
          {" • Compete. Rank. Win."}
        </Text>
      </View>
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
  shareHeaderBtn: { padding: 6, minWidth: 32, alignItems: "center" },
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
    marginBottom: 12,
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

  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  shareBtnText: { fontSize: 15, fontWeight: "700" },

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
  youBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
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

  offScreen: {
    position: "absolute",
    left: -9999,
    top: 0,
    opacity: 0,
  },
});

const shareStyles = StyleSheet.create({
  card: {
    width: 360,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  brandName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  cardLabel: { fontSize: 10, fontWeight: "700", color: "#ffffff40", letterSpacing: 2, textTransform: "uppercase" },

  examBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    gap: 8,
    alignItems: "center",
  },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  catBadgeText: { fontSize: 11, fontWeight: "700" },
  examTitleText: { fontSize: 17, fontWeight: "800", color: "#fff", textAlign: "center", lineHeight: 22 },

  heroRow: { flexDirection: "row", alignItems: "stretch" },
  heroDivider: { width: 1, marginHorizontal: 12 },
  heroBox: { flex: 1, alignItems: "center", gap: 4, padding: 12, borderRadius: 16, borderWidth: 1 },
  heroEmoji: { fontSize: 28 },
  heroVal: { fontSize: 20, fontWeight: "900" },
  heroLbl: { fontSize: 11, color: "#ffffff50", fontWeight: "600" },
  pctCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  pctText: { fontSize: 13, fontWeight: "900" },

  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  statPillIcon: { fontSize: 14 },
  statPillVal: { fontSize: 16, fontWeight: "800" },
  statPillLbl: { fontSize: 9, color: "#ffffff50", fontWeight: "600" },

  perfRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  perfEmoji: { fontSize: 20 },
  perfMsg: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  footer: { alignItems: "center" },
  footerTag: { fontSize: 12 },
});
