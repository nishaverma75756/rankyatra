import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";

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
          // Fallback to URL param data
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
      // For other user's profile — use data from params
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

  const handleShare = async () => {
    if (!result) return;
    const pct = result.totalQuestions > 0
      ? Math.round((result.correctAnswers / result.totalQuestions) * 100)
      : 0;
    const medal = result.rank === 1 ? "🥇" : result.rank === 2 ? "🥈" : result.rank === 3 ? "🥉" : result.rank ? `#${result.rank}` : "—";
    await Share.share({
      message: [
        `📊 My Exam Result on RankYatra`,
        `Exam: ${result.examTitle}`,
        `Score: ${result.score} pts | Accuracy: ${pct}%`,
        `Correct: ${result.correctAnswers} | Wrong: ${result.wrongAnswers} | Skipped: ${result.skippedAnswers}`,
        `Rank: ${medal} | Time: ${fmtTime(result.timeTakenSeconds)}`,
        ``,
        `Join me on RankYatra — rankyatra.in`,
      ].join("\n"),
    });
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
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Feather name="share-2" size={20} color={colors.primary} />
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
          {/* Rank Card */}
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
            <Text style={styles.heroEmoji}>{medal ?? "🏅"}</Text>
            <Text style={[styles.heroValue, { color: result.rank && result.rank <= 3 ? "#f59e0b" : colors.foreground }]}>
              {rankLabel}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Your Rank</Text>
          </View>

          {/* Score Card */}
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
          <StatCard
            icon="check-circle"
            iconColor="#22c55e"
            iconBg="#22c55e18"
            value={String(result.correctAnswers)}
            label="Correct"
            colors={colors}
          />
          <StatCard
            icon="x-circle"
            iconColor="#ef4444"
            iconBg="#ef444418"
            value={String(result.wrongAnswers)}
            label="Wrong"
            colors={colors}
          />
          <StatCard
            icon="minus-circle"
            iconColor="#6b7280"
            iconBg="#6b728018"
            value={String(result.skippedAnswers)}
            label="Skipped"
            colors={colors}
          />
          <StatCard
            icon="help-circle"
            iconColor="#3b82f6"
            iconBg="#3b82f618"
            value={String(result.totalQuestions)}
            label="Total Qs"
            colors={colors}
          />
        </View>

        {/* Details */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>

          <DetailRow
            icon="clock"
            iconColor="#8b5cf6"
            label="Time Taken"
            value={fmtTime(result.timeTakenSeconds)}
            colors={colors}
          />
          <DetailRow
            icon="book-open"
            iconColor="#f97316"
            label="Category"
            value={result.examCategory}
            colors={colors}
          />
          {Number(result.entryFee) > 0 && (
            <DetailRow
              icon="credit-card"
              iconColor="#059669"
              label="Entry Fee"
              value={`₹${Number(result.entryFee).toLocaleString("en-IN")}`}
              colors={colors}
            />
          )}
          <DetailRow
            icon="calendar"
            iconColor="#0ea5e9"
            label="Submitted"
            value={fmtDate(result.submittedAt)}
            colors={colors}
            last
          />
        </View>

        {/* Performance Message */}
        <View style={[styles.perfMsg, {
          backgroundColor: pctColor + "15",
          borderColor: pctColor + "40",
        }]}>
          <Text style={[styles.perfEmoji]}>
            {pct >= 80 ? "🎯" : pct >= 60 ? "👍" : pct >= 40 ? "📚" : "💪"}
          </Text>
          <Text style={[styles.perfText, { color: pctColor }]}>
            {pct >= 80
              ? "Excellent performance! Keep it up!"
              : pct >= 60
              ? "Good job! A little more practice and you'll ace it."
              : pct >= 40
              ? "Keep practicing — you're getting there!"
              : "Don't give up! Review the topics and try again."}
          </Text>
        </View>

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
  shareBtn: { padding: 4 },

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

  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  ctaBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
