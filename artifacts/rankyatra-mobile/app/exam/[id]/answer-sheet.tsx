import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type AnswerQuestion = {
  index: number;
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  selectedOption: string | null;
  isCorrect: boolean;
  isSkipped: boolean;
};

type AnswerSheet = {
  exam: { id: number; title: string; category: string };
  submission: {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    rank: number | null;
    timeTakenSeconds: number;
  } | null;
  questions: AnswerQuestion[];
};

const OPTION_LABELS = ["A", "B", "C", "D"];

function getOptionText(q: AnswerQuestion, opt: string): string {
  if (opt === "A") return q.optionA;
  if (opt === "B") return q.optionB;
  if (opt === "C") return q.optionC;
  return q.optionD;
}

export default function AnswerSheetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data, isLoading, error } = useQuery<AnswerSheet>({
    queryKey: ["answer-sheet", id],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/exams/${id}/answer-sheet`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to load");
      }
      return r.json();
    },
    enabled: !!id && !!token,
  });

  const filteredQs = data?.questions.filter((q) => {
    if (filter === "correct") return q.isCorrect;
    if (filter === "wrong") return !q.isCorrect && !q.isSkipped;
    if (filter === "skipped") return q.isSkipped;
    return true;
  }) ?? [];

  const correctCount = data?.questions.filter((q) => q.isCorrect).length ?? 0;
  const wrongCount = data?.questions.filter((q) => !q.isCorrect && !q.isSkipped).length ?? 0;
  const skippedCount = data?.questions.filter((q) => q.isSkipped).length ?? 0;
  const total = data?.questions.length ?? 0;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Answer Sheet</Text>
          {data && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {data.exam.title}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading answer sheet...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color="#ef4444" />
          <Text style={[styles.errorText, { color: "#ef4444" }]}>
            {(error as Error).message}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtnFull, { backgroundColor: colors.primary }]}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Score Summary — tap to filter */}
          <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.scoreRow}>
              {/* All */}
              <TouchableOpacity
                style={[styles.scoreItem, filter === "all" && [styles.scoreItemActive, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]]}
                onPress={() => setFilter("all")}
                activeOpacity={0.7}
              >
                <Text style={[styles.scoreNum, { color: colors.primary }]}>{total}</Text>
                <Text style={[styles.scoreLabel, { color: filter === "all" ? colors.primary : colors.mutedForeground, fontWeight: filter === "all" ? "800" : "600" }]}>All</Text>
              </TouchableOpacity>

              {/* Correct */}
              <TouchableOpacity
                style={[styles.scoreItem, filter === "correct" && [styles.scoreItemActive, { backgroundColor: "#22c55e15", borderColor: "#22c55e" }]]}
                onPress={() => setFilter("correct")}
                activeOpacity={0.7}
              >
                <Text style={[styles.scoreNum, { color: "#22c55e" }]}>{correctCount}</Text>
                <Text style={[styles.scoreLabel, { color: filter === "correct" ? "#22c55e" : colors.mutedForeground, fontWeight: filter === "correct" ? "800" : "600" }]}>Correct</Text>
              </TouchableOpacity>

              {/* Wrong */}
              <TouchableOpacity
                style={[styles.scoreItem, filter === "wrong" && [styles.scoreItemActive, { backgroundColor: "#ef444415", borderColor: "#ef4444" }]]}
                onPress={() => setFilter("wrong")}
                activeOpacity={0.7}
              >
                <Text style={[styles.scoreNum, { color: "#ef4444" }]}>{wrongCount}</Text>
                <Text style={[styles.scoreLabel, { color: filter === "wrong" ? "#ef4444" : colors.mutedForeground, fontWeight: filter === "wrong" ? "800" : "600" }]}>Wrong</Text>
              </TouchableOpacity>

              {/* Skipped */}
              <TouchableOpacity
                style={[styles.scoreItem, filter === "skipped" && [styles.scoreItemActive, { backgroundColor: "#9ca3af15", borderColor: "#9ca3af" }]]}
                onPress={() => setFilter("skipped")}
                activeOpacity={0.7}
              >
                <Text style={[styles.scoreNum, { color: "#9ca3af" }]}>{skippedCount}</Text>
                <Text style={[styles.scoreLabel, { color: filter === "skipped" ? "#9ca3af" : colors.mutedForeground, fontWeight: filter === "skipped" ? "800" : "600" }]}>Skipped</Text>
              </TouchableOpacity>

              {/* Accuracy */}
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreNum, { color: accuracy >= 60 ? "#22c55e" : accuracy >= 40 ? "#f59e0b" : "#ef4444" }]}>{accuracy}%</Text>
                <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>Accuracy</Text>
              </View>
            </View>

            {data.submission?.rank && (
              <View style={[styles.rankRow, { borderTopColor: colors.border }]}>
                <Feather name="award" size={14} color={colors.primary} />
                <Text style={[styles.rankText, { color: colors.foreground }]}>
                  Your Rank: <Text style={{ color: colors.primary, fontWeight: "800" }}>#{data.submission.rank}</Text>
                </Text>
              </View>
            )}

            <View style={[styles.filterHint, { borderTopColor: colors.border }]}>
              <Feather name="info" size={11} color={colors.mutedForeground} />
              <Text style={[styles.filterHintText, { color: colors.mutedForeground }]}>Tap any stat above to filter questions</Text>
            </View>
          </View>

          {/* Questions */}
          {filteredQs.length === 0 ? (
            <View style={styles.emptyFilter}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "600" }}>No questions in this filter</Text>
            </View>
          ) : (
            filteredQs.map((q) => (
              <View
                key={q.id}
                style={[
                  styles.qCard,
                  {
                    borderColor: q.isCorrect ? "#22c55e40" : q.isSkipped ? colors.border : "#ef444440",
                    backgroundColor: q.isCorrect ? "#22c55e08" : q.isSkipped ? colors.card : "#ef444408",
                  },
                ]}
              >
                {/* Q Header */}
                <View style={styles.qHeader}>
                  <View style={[styles.qNum, { backgroundColor: q.isCorrect ? "#22c55e" : q.isSkipped ? "#9ca3af" : "#ef4444" }]}>
                    <Text style={styles.qNumText}>Q{q.index}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: q.isCorrect ? "#22c55e15" : q.isSkipped ? "#9ca3af15" : "#ef444415" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: q.isCorrect ? "#22c55e" : q.isSkipped ? "#9ca3af" : "#ef4444" }}>
                      {q.isCorrect ? "CORRECT" : q.isSkipped ? "SKIPPED" : "WRONG"}
                    </Text>
                  </View>
                </View>

                {/* Question Text */}
                <Text style={[styles.qText, { color: colors.foreground }]}>{q.questionText}</Text>

                {/* Options with per-option explanations */}
                <View style={styles.optionsList}>
                  {OPTION_LABELS.map((opt) => {
                    const optText = getOptionText(q, opt);
                    const isCorrect = q.correctOption === opt;
                    const isSelected = q.selectedOption === opt;
                    const isWrong = isSelected && !isCorrect;
                    const expKey = `explanation${opt}` as keyof typeof q;
                    const explanation = q[expKey] as string | null;

                    let bg = colors.muted;
                    let border = "transparent";
                    let textColor = colors.foreground;

                    if (isCorrect) { bg = "#22c55e18"; border = "#22c55e"; textColor = "#22c55e"; }
                    if (isWrong) { bg = "#ef444418"; border = "#ef4444"; textColor = "#ef4444"; }

                    const expBg = isCorrect ? "#f0fdf4" : isWrong ? "#fef2f2" : "#f8fafc";
                    const expColor = isCorrect ? "#16a34a" : isWrong ? "#dc2626" : "#64748b";
                    const expBorder = isCorrect ? "#22c55e40" : isWrong ? "#ef444440" : "#e2e8f0";

                    return (
                      <View key={opt}>
                        <View style={[
                          styles.option,
                          { backgroundColor: bg, borderColor: border },
                          explanation ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 } : {},
                        ]}>
                          <View style={[styles.optBadge, { backgroundColor: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : colors.border }]}>
                            <Text style={[styles.optBadgeText, { color: (isCorrect || isWrong) ? "#fff" : colors.mutedForeground }]}>{opt}</Text>
                          </View>
                          <Text style={[styles.optText, { color: textColor, fontWeight: isCorrect ? "700" : "500" }]} numberOfLines={3}>
                            {optText}
                          </Text>
                          {isCorrect && <Feather name="check-circle" size={16} color="#22c55e" />}
                          {isWrong && <Feather name="x-circle" size={16} color="#ef4444" />}
                        </View>
                        {explanation ? (
                          <View style={[styles.expRow, { backgroundColor: expBg, borderColor: expBorder }]}>
                            <Text style={{ fontSize: 11, color: expColor, lineHeight: 16 }}>💡 {explanation}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* Correct Answer hint — only shown when no explanations exist */}
                {!q.isCorrect && !q.explanationA && !q.explanationB && !q.explanationC && !q.explanationD && (
                  <View style={[styles.correctHint, { backgroundColor: "#22c55e12", borderColor: "#22c55e30" }]}>
                    <Feather name="check-circle" size={13} color="#22c55e" />
                    <Text style={[styles.correctHintText, { color: "#22c55e" }]}>
                      Correct Answer: ({q.correctOption}) {getOptionText(q, q.correctOption)}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  loadingText: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  errorText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  backBtnFull: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  scoreRow: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 },
  scoreItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  scoreItemActive: { borderWidth: 1.5 },
  scoreNum: { fontSize: 22, fontWeight: "900" },
  scoreLabel: { fontSize: 10, fontWeight: "600" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  rankText: { fontSize: 13, fontWeight: "600" },
  filterHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  filterHintText: { fontSize: 11, fontWeight: "500" },
  emptyFilter: { alignItems: "center", paddingVertical: 32 },
  qCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  qHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  qNum: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  qNumText: { fontSize: 11, fontWeight: "900", color: "#fff" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  optionsList: { gap: 7 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  optBadge: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  optBadgeText: { fontSize: 11, fontWeight: "800" },
  optText: { flex: 1, fontSize: 13, lineHeight: 18 },
  expRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 2,
  },
  correctHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  correctHintText: { fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 17 },
  explanationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
});
