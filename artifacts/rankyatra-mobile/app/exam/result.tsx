import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system/legacy";
import { showError } from "@/utils/alert";

interface ExamResult {
  id: number;
  examId: number;
  examTitle: string;
  examCategory: string;
  entryFee: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  timeTakenSeconds: number;
  rank: number | null;
  submittedAt: string;
}

function fmtTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function AccuracyBar({ pct, colors }: { pct: number; colors: any }) {
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
  return (
    <View style={{ marginTop: 6 }}>
      <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>0%</Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color }}>{pct}% Accuracy</Text>
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>100%</Text>
      </View>
    </View>
  );
}

export default function ExamResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const shareCardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const params = useLocalSearchParams<{
    examId: string;
    examTitle: string;
    examCategory: string;
    entryFee: string;
    score: string;
    totalQuestions: string;
    correctAnswers: string;
    timeTakenSeconds: string;
    rank: string;
    submittedAt: string;
    isSelf: string;
  }>();

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);

  const isSelf = params.isSelf === "true";

  useEffect(() => {
    if (isSelf && params.examId) {
      customFetch<ExamResult>(`/api/exams/${params.examId}/my-result`)
        .then((data) => setResult(data))
        .catch(() => {
          setResult({
            id: 0,
            examId: Number(params.examId),
            examTitle: params.examTitle ?? "Exam",
            examCategory: params.examCategory ?? "",
            entryFee: params.entryFee ?? "0",
            score: Number(params.score ?? 0),
            totalQuestions: Number(params.totalQuestions ?? 0),
            correctAnswers: Number(params.correctAnswers ?? 0),
            wrongAnswers: Number(params.totalQuestions ?? 0) - Number(params.correctAnswers ?? 0),
            skippedAnswers: 0,
            timeTakenSeconds: Number(params.timeTakenSeconds ?? 0),
            rank: params.rank ? Number(params.rank) : null,
            submittedAt: params.submittedAt ?? new Date().toISOString(),
          });
        })
        .finally(() => setLoading(false));
    } else {
      const total = Number(params.totalQuestions ?? 0);
      const correct = Number(params.correctAnswers ?? 0);
      setResult({
        id: 0,
        examId: Number(params.examId),
        examTitle: params.examTitle ?? "Exam",
        examCategory: params.examCategory ?? "",
        entryFee: params.entryFee ?? "0",
        score: Number(params.score ?? 0),
        totalQuestions: total,
        correctAnswers: correct,
        wrongAnswers: total - correct,
        skippedAnswers: 0,
        timeTakenSeconds: Number(params.timeTakenSeconds ?? 0),
        rank: params.rank ? Number(params.rank) : null,
        submittedAt: params.submittedAt ?? new Date().toISOString(),
      });
      setLoading(false);
    }
  }, [params.examId, isSelf]);

  const handleShareImage = async () => {
    if (!result || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const rankStr = result.rank ? `#${result.rank}` : "—";
      const pctVal = result.totalQuestions > 0
        ? Math.round((result.correctAnswers / result.totalQuestions) * 100)
        : 0;
      const shareEmoji = pctVal >= 80 ? "🎯" : pctVal >= 60 ? "👍" : pctVal >= 40 ? "📚" : "💪";
      const motivationalLine = pctVal >= 80
        ? "Excellent performance! Kept it up and nailed it! 🎯"
        : pctVal >= 60
        ? "Good job! A little more practice and you'll ace it! 👍"
        : pctVal >= 40
        ? "Keep going — every attempt makes you stronger! 📚"
        : "Don't give up! Review the topics and try again. 💪";

      const shareText = [
        `${shareEmoji} Just completed an exam on RankYatra!`,
        ``,
        `📋 ${result.examTitle}`,
        `🏷️ Category: ${result.examCategory}`,
        ``,
        `🏆 Rank: ${rankStr}`,
        `📊 Score: ${result.score} pts  |  Accuracy: ${pctVal}%`,
        `✅ Correct: ${result.correctAnswers}  ❌ Wrong: ${result.wrongAnswers}  ⏭️ Skipped: ${result.skippedAnswers}`,
        ``,
        `${motivationalLine}`,
        ``,
        `🌐 rankyatra.in — Compete. Rank. Win.`,
      ].join("\n");

      if (Platform.OS === "android") {
        // Android: convert file:// URI → content:// FileProvider URI so apps
        // like WhatsApp can read the image, then ACTION_SEND with image + text
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync("android.intent.action.SEND", {
          type: "image/png",
          extra: {
            "android.intent.extra.STREAM": contentUri,
            "android.intent.extra.TEXT": shareText,
            "android.intent.extra.SUBJECT": `My Result — ${result.examTitle}`,
          },
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
      } else {
        // iOS: Share.share natively supports url (image) + message (text) together
        await Share.share({
          url: uri,
          message: shareText,
          title: `My Result — ${result.examTitle}`,
        });
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (!msg.includes("cancelled") && !msg.includes("User did not share") && !msg.includes("dismissed")) {
        showError("Could not share result. Please try again.");
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <View style={{ paddingTop: insets.top }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Result not found</Text>
      </View>
    );
  }

  const pct = result.totalQuestions > 0
    ? Math.round((result.correctAnswers / result.totalQuestions) * 100)
    : 0;
  const pctColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
  const medal = result.rank === 1 ? "🥇" : result.rank === 2 ? "🥈" : result.rank === 3 ? "🥉" : null;
  const rankLabel = medal ?? (result.rank ? `#${result.rank}` : "—");
  const perfMsg = pct >= 80 ? "Excellent performance! Keep it up!" : pct >= 60 ? "Good job! A little more practice and you'll ace it." : pct >= 40 ? "Keep practicing — you're getting there!" : "Don't give up! Review the topics and try again.";
  const perfEmoji = pct >= 80 ? "🎯" : pct >= 60 ? "👍" : pct >= 40 ? "📚" : "💪";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          Result
        </Text>
        <TouchableOpacity onPress={handleShareImage} style={styles.shareBtn} disabled={sharing}>
          {sharing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Feather name="share-2" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 20 }}
      >
        {/* Exam Info */}
        <View style={[styles.examHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>{result.examCategory}</Text>
          </View>
          <Text style={[styles.examTitle, { color: colors.foreground }]}>{result.examTitle}</Text>
          <Text style={[styles.examDate, { color: colors.mutedForeground }]}>
            Submitted on {fmtDate(result.submittedAt)}
          </Text>
        </View>

        {/* Rank + Score Hero */}
        <View style={[styles.heroRow, { gap: 12 }]}>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
            <Text style={styles.heroEmoji}>{medal ?? "🏅"}</Text>
            <Text style={[styles.heroValue, { color: result.rank && result.rank <= 3 ? "#f59e0b" : colors.foreground }]}>
              {result.rank ? `#${result.rank}` : "—"}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Your Rank</Text>
          </View>

          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
            <View style={[styles.scoreCircle, { borderColor: pctColor }]}>
              <Text style={[styles.scorePct, { color: pctColor }]}>{pct}%</Text>
            </View>
            <Text style={[styles.heroValue, { color: colors.foreground }]}>{result.score} pts</Text>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Score</Text>
          </View>
        </View>

        {/* Accuracy Bar */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Accuracy</Text>
          <AccuracyBar pct={pct} colors={colors} />
        </View>

        {/* Q&A Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard icon="check-circle" iconColor="#22c55e" iconBg="#22c55e18" value={String(result.correctAnswers)} label="Correct" colors={colors} />
          <StatCard icon="x-circle" iconColor="#ef4444" iconBg="#ef444418" value={String(result.wrongAnswers)} label="Wrong" colors={colors} />
          <StatCard icon="minus-circle" iconColor="#6b7280" iconBg="#6b728018" value={String(result.skippedAnswers)} label="Skipped" colors={colors} />
          <StatCard icon="help-circle" iconColor="#3b82f6" iconBg="#3b82f618" value={String(result.totalQuestions)} label="Total Qs" colors={colors} />
        </View>

        {/* Details */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
          <DetailRow icon="clock" iconColor="#8b5cf6" label="Time Taken" value={fmtTime(result.timeTakenSeconds)} colors={colors} />
          <DetailRow icon="book-open" iconColor="#f97316" label="Category" value={result.examCategory} colors={colors} />
          {Number(result.entryFee) > 0 && (
            <DetailRow icon="credit-card" iconColor="#059669" label="Entry Fee" value={`₹${Number(result.entryFee).toLocaleString("en-IN")}`} colors={colors} />
          )}
          <DetailRow icon="calendar" iconColor="#0ea5e9" label="Submitted" value={fmtDate(result.submittedAt)} colors={colors} last />
        </View>

        {/* Performance Message */}
        <View style={[styles.perfMsg, { backgroundColor: pctColor + "15", borderColor: pctColor + "40" }]}>
          <Text style={styles.perfEmoji}>{perfEmoji}</Text>
          <Text style={[styles.perfText, { color: pctColor }]}>{perfMsg}</Text>
        </View>

        {/* Share Result Button */}
        {isSelf && (
          <TouchableOpacity
            style={[styles.shareResultBtn, { backgroundColor: colors.card, borderColor: colors.primary }]}
            onPress={handleShareImage}
            disabled={sharing}
            activeOpacity={0.8}
          >
            {sharing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="share-2" size={17} color={colors.primary} />}
            <Text style={[styles.shareResultBtnText, { color: colors.primary }]}>
              {sharing ? "Generating Image..." : "Share My Result"}
            </Text>
          </TouchableOpacity>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/exams" as any)}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={17} color="#fff" />
          <Text style={styles.ctaBtnText}>Join Another Contest</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Off-screen shareable result card (captured as image) */}
      <View style={styles.offScreen} pointerEvents="none">
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <ResultShareCard result={result} pct={pct} pctColor={pctColor} rankLabel={rankLabel} medal={medal} perfMsg={perfMsg} perfEmoji={perfEmoji} userName={user?.name} />
        </ViewShot>
      </View>
    </View>
  );
}

function ResultShareCard({ result, pct, pctColor, medal, perfMsg, perfEmoji, userName }: {
  result: ExamResult;
  pct: number;
  pctColor: string;
  rankLabel: string;
  medal: string | null;
  perfMsg: string;
  perfEmoji: string;
  userName?: string;
}) {
  const isTop3 = result.rank !== null && result.rank <= 3;
  const accentColor = "#f97316";
  const rankNumLabel = result.rank ? `#${result.rank}` : "—";

  return (
    <View style={shareStyles.card}>
      {/* Header — logo image + EXAM RESULT label */}
      <View style={shareStyles.cardHeader}>
        <Image
          source={require("@/assets/images/rankyatra-brand-logo.png")}
          style={shareStyles.logoImg}
          resizeMode="contain"
        />
        <Text style={shareStyles.cardLabel}>EXAM RESULT</Text>
      </View>

      {/* Exam title */}
      <View style={[shareStyles.examBlock, { borderColor: "#e2e8f0" }]}>
        <View style={[shareStyles.catBadge, { backgroundColor: accentColor + "20" }]}>
          <Text style={[shareStyles.catBadgeText, { color: accentColor }]}>{result.examCategory}</Text>
        </View>
        <Text style={shareStyles.examTitleText} numberOfLines={2}>{result.examTitle}</Text>
      </View>

      {/* Rank + Score row */}
      <View style={shareStyles.heroRow}>
        <View style={[shareStyles.heroBox, { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }]}>
          <Text style={shareStyles.heroEmoji}>{medal ?? "🏅"}</Text>
          <Text style={[shareStyles.heroVal, { color: isTop3 ? "#d97706" : "#0f172a" }]}>{rankNumLabel}</Text>
          <Text style={shareStyles.heroLbl}>Your Rank</Text>
        </View>
        <View style={[shareStyles.heroDivider, { backgroundColor: "#e2e8f0" }]} />
        <View style={[shareStyles.heroBox, { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }]}>
          <View style={[shareStyles.pctCircle, { borderColor: pctColor }]}>
            <Text style={[shareStyles.pctText, { color: pctColor }]}>{pct}%</Text>
          </View>
          <Text style={[shareStyles.heroVal, { color: "#0f172a" }]}>{result.score} pts</Text>
          <Text style={shareStyles.heroLbl}>Score</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={shareStyles.statsRow}>
        <View style={[shareStyles.statPill, { backgroundColor: "#dcfce7" }]}>
          <Text style={shareStyles.statPillIcon}>✅</Text>
          <Text style={[shareStyles.statPillVal, { color: "#16a34a" }]}>{result.correctAnswers}</Text>
          <Text style={[shareStyles.statPillLbl, { color: "#6b7280" }]}>Correct</Text>
        </View>
        <View style={[shareStyles.statPill, { backgroundColor: "#fee2e2" }]}>
          <Text style={shareStyles.statPillIcon}>❌</Text>
          <Text style={[shareStyles.statPillVal, { color: "#dc2626" }]}>{result.wrongAnswers}</Text>
          <Text style={[shareStyles.statPillLbl, { color: "#6b7280" }]}>Wrong</Text>
        </View>
        <View style={[shareStyles.statPill, { backgroundColor: "#f1f5f9" }]}>
          <Text style={shareStyles.statPillIcon}>⏭</Text>
          <Text style={[shareStyles.statPillVal, { color: "#475569" }]}>{result.skippedAnswers}</Text>
          <Text style={[shareStyles.statPillLbl, { color: "#6b7280" }]}>Skipped</Text>
        </View>
        <View style={[shareStyles.statPill, { backgroundColor: "#f5f3ff" }]}>
          <Text style={shareStyles.statPillIcon}>⏱</Text>
          <Text style={[shareStyles.statPillVal, { color: "#7c3aed" }]}>{result.timeTakenSeconds > 0 ? `${Math.floor(result.timeTakenSeconds / 60)}m` : "—"}</Text>
          <Text style={[shareStyles.statPillLbl, { color: "#6b7280" }]}>Time</Text>
        </View>
      </View>

      {/* Performance message */}
      <View style={[shareStyles.perfRow, { backgroundColor: pctColor + "15", borderColor: pctColor + "40" }]}>
        <Text style={shareStyles.perfEmoji}>{perfEmoji}</Text>
        <Text style={[shareStyles.perfMsg, { color: pctColor }]} numberOfLines={2}>{perfMsg}</Text>
      </View>

      {/* Footer */}
      <View style={shareStyles.footer}>
        <Text style={shareStyles.footerTag}>
          {userName ? `${userName} on ` : ""}
          <Text style={{ color: accentColor, fontWeight: "800" }}>rankyatra.in</Text>
          {" • Compete. Rank. Win."}
        </Text>
      </View>
    </View>
  );
}

function StatCard({ icon, iconColor, iconBg, value, label, colors }: {
  icon: string; iconColor: string; iconBg: string;
  value: string; label: string; colors: any;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon, iconColor, label, value, colors, last = false }: {
  icon: string; iconColor: string; label: string; value: string; colors: any; last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.detailIcon, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800" },
  shareBtn: { padding: 4, minWidth: 28, alignItems: "center" },

  examHeader: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
    gap: 6,
  },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  categoryText: { fontSize: 12, fontWeight: "700" },
  examTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 24 },
  examDate: { fontSize: 12 },

  heroRow: { flexDirection: "row", marginBottom: 14 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  heroEmoji: { fontSize: 32 },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  scorePct: { fontSize: 16, fontWeight: "900" },
  heroValue: { fontSize: 22, fontWeight: "900" },
  heroLabel: { fontSize: 12 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 12 },

  barTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 12 },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  detailIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  detailLabel: { flex: 1, fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: "700" },

  perfMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  perfEmoji: { fontSize: 24 },
  perfText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },

  shareResultBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  shareResultBtnText: { fontSize: 15, fontWeight: "700" },

  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  ctaBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

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
    backgroundColor: "#ffffff",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoImg: { width: 140, height: 44 },
  cardLabel: { fontSize: 10, fontWeight: "700", color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase" },

  examBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    gap: 8,
    alignItems: "center",
  },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  catBadgeText: { fontSize: 11, fontWeight: "700" },
  examTitleText: { fontSize: 17, fontWeight: "800", color: "#0f172a", textAlign: "center", lineHeight: 22 },

  heroRow: { flexDirection: "row", alignItems: "stretch" },
  heroDivider: { width: 1, marginHorizontal: 12 },
  heroBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroEmoji: { fontSize: 28 },
  heroVal: { fontSize: 20, fontWeight: "900" },
  heroLbl: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  pctCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  pctText: { fontSize: 13, fontWeight: "900" },

  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  statPillIcon: { fontSize: 14 },
  statPillVal: { fontSize: 16, fontWeight: "800" },
  statPillLbl: { fontSize: 9, fontWeight: "600" },

  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  perfEmoji: { fontSize: 20 },
  perfMsg: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  footer: { alignItems: "center" },
  footerTag: { fontSize: 12, color: "#94a3b8" },
});
