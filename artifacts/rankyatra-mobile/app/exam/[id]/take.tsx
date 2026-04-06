import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  BackHandler,
  AppState,
} from "react-native";
import { showError, showConfirm } from "@/utils/alert";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetExam, useGetExamQuestions, useGetRegistrationStatus, submitExam, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useKeepAwake } from "expo-keep-awake";

export default function TakeExamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ── All useState declarations first ──────────────────────────────────────
  const QUESTION_LIMIT = 20;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeTakenPerQuestion, setTimeTakenPerQuestion] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(QUESTION_LIMIT);
  const [secondsLeft, setSecondsLeft] = useState(20 * 60); // updated from exam data via useEffect
  const [elapsed, setElapsed] = useState(0);

  // ── All useRef declarations next ─────────────────────────────────────────
  const startTimeRef = useRef(Date.now());
  const questionStartTimeRef = useRef(Date.now());
  const timeTakenPerQuestionRef = useRef<Record<string, number>>({});
  const minimizeCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const handleSubmitRef = useRef<(forced?: boolean) => void>(() => {});
  const questionsLengthRef = useRef(0);
  const currentQRef = useRef(0);
  const questionsRef = useRef<any[]>([]);
  const wmX = useRef(new Animated.Value(0)).current;
  const wmY = useRef(new Animated.Value(0)).current;

  // ── Custom hooks ─────────────────────────────────────────────────────────
  const { data: meData } = useGetMe();
  usePreventScreenCapture();
  useKeepAwake();

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: exam } = useGetExam(Number(id));
  const { data: questionsRaw, isLoading } = useGetExamQuestions(Number(id));
  const { data: regStatus, isLoading: regLoading } = useGetRegistrationStatus(Number(id));
  const questions = (questionsRaw ?? []) as any[];

  // ── All useEffect declarations ────────────────────────────────────────────

  // Sync secondsLeft from exam end_time when exam data loads
  useEffect(() => {
    if (!exam) return;
    const raw = exam as any;
    const endStr = raw?.endTime ?? raw?.end_time;
    if (!endStr) return;
    const remaining = Math.max(0, Math.round((new Date(endStr).getTime() - Date.now()) / 1000));
    setSecondsLeft(remaining);
  }, [exam]);

  // Keep ref arrays in sync
  useEffect(() => { questionsLengthRef.current = questions.length; questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);

  // Animated watermark — slow drift defeats autofocus on external cameras
  useEffect(() => {
    const drift = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(wmX, { toValue: 30, duration: 7000, useNativeDriver: true }),
          Animated.timing(wmY, { toValue: 20, duration: 7000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(wmX, { toValue: -20, duration: 9000, useNativeDriver: true }),
          Animated.timing(wmY, { toValue: -15, duration: 9000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(wmX, { toValue: 15, duration: 8000, useNativeDriver: true }),
          Animated.timing(wmY, { toValue: 25, duration: 8000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(wmX, { toValue: 0, duration: 6000, useNativeDriver: true }),
          Animated.timing(wmY, { toValue: 0, duration: 6000, useNativeDriver: true }),
        ]),
      ])
    );
    drift.start();
    return () => drift.stop();
  }, []);

  // Back button disable on Android
  useEffect(() => {
    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }
  }, []);

  // Minimize / background detection
  useEffect(() => {
    let lastState = AppState.currentState;
    const sub = AppState.addEventListener("change", (nextState) => {
      const wasActive = lastState === "active";
      lastState = nextState;
      if (wasActive && nextState === "background") {
        minimizeCountRef.current += 1;
        const count = minimizeCountRef.current;
        const total = questionsLengthRef.current;
        const curr = currentQRef.current;
        if (total > 0) {
          const qId = questionsRef.current[curr]?.id;
          if (qId != null) {
            setAnswers((prev) => {
              const next = { ...prev };
              delete next[qId];
              return next;
            });
            timeTakenPerQuestionRef.current[String(qId)] = QUESTION_LIMIT;
            setTimeTakenPerQuestion({ ...timeTakenPerQuestionRef.current });
          }
          if (curr < total - 1) {
            setCurrentQ((p) => p + 1);
          }
        }
        if (count >= 5) {
          handleSubmitRef.current(true);
        }
      }
      if (nextState === "active" && minimizeCountRef.current >= 3 && minimizeCountRef.current < 5) {
        showError(
          "Warning",
          `App minimize detected ${minimizeCountRef.current} time(s). Exam will auto-submit if you minimize again.`
        );
      }
    });
    return () => sub.remove();
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Overall exam countdown — setInterval is more reliable than chained setTimeout
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          handleSubmitRef.current(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Elapsed time tracker
  useEffect(() => {
    const interval = setInterval(
      () => setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, []);

  // Per-question 20-second timer — resets every time currentQ changes
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    setQuestionSecondsLeft(QUESTION_LIMIT);
    const interval = setInterval(() => {
      setQuestionSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQ]);

  // When per-question timer hits 0 — skip question, go next
  useEffect(() => {
    if (questionSecondsLeft !== 0) return;
    const total = questionsLengthRef.current;
    if (total === 0) return;
    const curr = currentQRef.current;
    const qId = questionsRef.current[curr]?.id;
    if (qId != null) {
      setAnswers((prev) => { const next = { ...prev }; delete next[qId]; return next; });
      timeTakenPerQuestionRef.current[String(qId)] = QUESTION_LIMIT;
      setTimeTakenPerQuestion({ ...timeTakenPerQuestionRef.current });
    }
    if (curr < total - 1) {
      setCurrentQ((p) => p + 1);
    } else {
      handleSubmitRef.current(true);
    }
  }, [questionSecondsLeft]);

  const allAnsweredRef = useRef(false);

  const selectOption = useCallback((qId: number, option: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    const clampedElapsed = Math.min(QUESTION_LIMIT, Math.max(0, elapsed));
    timeTakenPerQuestionRef.current[String(qId)] = clampedElapsed;
    setTimeTakenPerQuestion({ ...timeTakenPerQuestionRef.current });
    setAnswers((prev) => ({ ...prev, [qId]: option }));
  }, []);

  useEffect(() => {
    if (
      questions.length > 0 &&
      Object.keys(answers).length === questions.length &&
      !allAnsweredRef.current &&
      !submitting
    ) {
      allAnsweredRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => handleSubmit(true), 1200);
      return () => clearTimeout(t);
    }
  }, [answers, questions.length, submitting]);

  const glanceAnim1 = useRef(new Animated.Value(0)).current;
  const glanceAnim2 = useRef(new Animated.Value(0)).current;
  const glanceAnim3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(glanceAnim1, { toValue: 1, duration: 1700, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(glanceAnim2, { toValue: 1, duration: 2300, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(glanceAnim3, { toValue: 1, duration: 1100, useNativeDriver: true })).start();
  }, []);

  const handleSubmit = useCallback(async (forced = false) => {
    if (!forced) {
      const answered = Object.keys(answers).length;
      const total = questions.length;
      if (answered < total) {
        showConfirm(
          "Incomplete Exam",
          `You've answered ${answered} out of ${total} questions. Unanswered questions will be marked as skipped. Submit anyway?`,
          () => handleSubmit(true),
          "Submit Now",
          "Continue Exam",
          "warning"
        );
        return;
      }
    }
    setSubmitting(true);
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const payload = questions
        .filter((q) => answers[q.id] != null)
        .map((q) => ({
          questionId: q.id,
          selectedOption: (answers[q.id] ?? "a").toUpperCase() as "A" | "B" | "C" | "D",
        }));
      await submitExam(Number(id), {
        answers: payload,
        timeTakenSeconds: timeTaken,
        timeTakenPerQuestion: timeTakenPerQuestionRef.current,
      });
      // Invalidate all related caches so My Exams updates instantly
      await queryClient.invalidateQueries();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/exam/${id}/results`);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("Submit Failed", e?.response?.data?.message ?? e?.message ?? "Failed to submit your answers. Please try again.");
      setSubmitting(false);
    }
  }, [answers, questions, id]);

  // Keep ref always pointing to the latest handleSubmit (avoids stale closure in interval callbacks)
  handleSubmitRef.current = handleSubmit;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const hasSubmitted = !regLoading && ((regStatus as any)?.hasSubmitted ?? false);

  if (isLoading || regLoading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Block re-taking if already submitted
  if (hasSubmitted) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: topPad + 12, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={[styles.flex, styles.center, { paddingHorizontal: 32 }]}>
          <View style={[styles.alreadyDoneIcon, { backgroundColor: colors.secondary + "20" }]}>
            <Feather name="check-circle" size={52} color={colors.secondary} />
          </View>
          <Text style={[styles.alreadyDoneTitle, { color: colors.foreground }]}>
            Already Submitted!
          </Text>
          <Text style={[styles.alreadyDoneSub, { color: colors.mutedForeground }]}>
            You have already given this exam. You cannot attempt it again.
          </Text>
          <TouchableOpacity
            style={[styles.alreadyDoneBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.replace(`/exam/${id}/results`)}
          >
            <Feather name="bar-chart-2" size={18} color="#fff" />
            <Text style={[styles.alreadyDoneBtnText]}>Check Your Exam Result</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.alreadyDoneBtnOutline, { borderColor: colors.border }]}
            onPress={() => router.replace("/(tabs)/")}
          >
            <Text style={[styles.alreadyDoneBtnOutlineText, { color: colors.mutedForeground }]}>
              Go to Home
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 15 }}>
          No questions found for this exam.
        </Text>
      </View>
    );
  }

  const q = questions[currentQ];
  const answered = Object.keys(answers).length;
  const remaining = questions.length - answered;
  const allAnswered = answered === questions.length && questions.length > 0;
  const progress = answered / questions.length;
  const isLastQ = currentQ === questions.length - 1;
  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const questionText = q?.questionText ?? q?.question_text ?? "";
  const OPTIONS: Array<{ key: string; label: string; originalKey: string }> =
    q?.shuffledOptions ?? [
      { key: "a", label: q?.optionA ?? q?.option_a ?? "", originalKey: "a" },
      { key: "b", label: q?.optionB ?? q?.option_b ?? "", originalKey: "b" },
      { key: "c", label: q?.optionC ?? q?.option_c ?? "", originalKey: "c" },
      { key: "d", label: q?.optionD ?? q?.option_d ?? "", originalKey: "d" },
    ];

  const timerColor = secondsLeft < 60 ? "#ef4444" : secondsLeft < 180 ? colors.saffron : "#22c55e";
  const qTimerColor = questionSecondsLeft <= 5 ? "#ef4444" : questionSecondsLeft <= 10 ? "#f59e0b" : "#22c55e";
  const qTimerProgress = questionSecondsLeft / 20;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
        <View style={styles.qCounter}>
          <Text style={[styles.qNum, { color: colors.foreground }]}>
            Q {currentQ + 1}/{questions.length}
          </Text>
        </View>
        <View style={[styles.timerBadge, { backgroundColor: timerColor + "20", borderColor: timerColor + "40" }]}>
          <Feather name="clock" size={13} color={timerColor} />
          <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(secondsLeft)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.submitSmall, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={() => handleSubmit(false)}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.submitSmallText, { color: colors.primaryForeground }]}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: colors.primary }]} />
      </View>

      {/* Per-question countdown timer */}
      <View style={[styles.qTimerRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.qTimerLabel, { color: colors.mutedForeground }]}>Question Time</Text>
        <View style={[styles.qTimerBar, { backgroundColor: colors.muted }]}>
          <View style={[styles.qTimerFill, { width: `${qTimerProgress * 100}%` as any, backgroundColor: qTimerColor }]} />
        </View>
        <Text style={[styles.qTimerSec, { color: qTimerColor }]}>{questionSecondsLeft}s</Text>
      </View>

      {/* Live Stats Row */}
      <View style={[styles.liveStats, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.liveStatItem}>
          <Text style={[styles.liveStatNum, { color: "#22c55e" }]}>{answered}</Text>
          <Text style={[styles.liveStatLabel, { color: colors.mutedForeground }]}>Answered</Text>
        </View>
        <View style={[styles.liveStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.liveStatItem}>
          <Text style={[styles.liveStatNum, { color: remaining > 0 ? "#f59e0b" : "#22c55e" }]}>{remaining}</Text>
          <Text style={[styles.liveStatLabel, { color: colors.mutedForeground }]}>Remaining</Text>
        </View>
        <View style={[styles.liveStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.liveStatItem}>
          <Text style={[styles.liveStatNum, { color: colors.foreground }]}>{questions.length}</Text>
          <Text style={[styles.liveStatLabel, { color: colors.mutedForeground }]}>Total</Text>
        </View>
        <View style={[styles.liveStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.liveStatItem}>
          <Text style={[styles.liveStatNum, { color: colors.primary }]}>{formatElapsed(elapsed)}</Text>
          <Text style={[styles.liveStatLabel, { color: colors.mutedForeground }]}>Time Spent</Text>
        </View>
      </View>

      {/* Question */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        key={q?.id}
      >
        <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.questionNum, { color: colors.mutedForeground }]}>
            Question {currentQ + 1}
          </Text>
          <Text selectable={false} style={[styles.questionText, { color: colors.foreground }]}>
            {questionText}
          </Text>
        </View>

        <View style={styles.options}>
          {OPTIONS.map(({ key, label, originalKey }) => {
            const isSelected = answers[q?.id] === originalKey;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.option,
                  {
                    backgroundColor: isSelected ? colors.primary + "15" : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => selectOption(q?.id, originalKey)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionBadge, { backgroundColor: isSelected ? colors.primary : colors.muted }]}>
                  <Text style={[styles.optionLetter, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]}>
                    {key.toUpperCase()}
                  </Text>
                </View>
                <Text selectable={false} style={[styles.optionText, { color: colors.foreground }]}>
                  {label}
                </Text>
                {isSelected && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* All answered overlay */}
      {allAnswered && submitting && (
        <View style={styles.submitOverlay}>
          <View style={[styles.submitOverlayCard, { backgroundColor: colors.card, borderColor: "#22c55e40" }]}>
            <ActivityIndicator color="#22c55e" size="large" />
            <Text style={[styles.submitOverlayTitle, { color: "#22c55e" }]}>All Answered!</Text>
            <Text style={[styles.submitOverlayText, { color: colors.mutedForeground }]}>
              Submitting your exam...
            </Text>
          </View>
        </View>
      )}

      {/* Navigation */}
      <View style={[styles.navFooter, {
        paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12),
        borderTopColor: colors.border,
        backgroundColor: colors.background,
      }]}>
        <View style={styles.dotRow}>
          {questions.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setCurrentQ(i)}>
              <View style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentQ
                      ? colors.primary
                      : answers[questions[i]?.id]
                      ? "#22c55e"
                      : colors.muted,
                },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: isLastQ ? colors.primary : colors.muted }]}
          onPress={() => {
            if (isLastQ) handleSubmit(false);
            else setCurrentQ((p) => Math.min(questions.length - 1, p + 1));
          }}
        >
          <Text style={[styles.navBtnText, { color: isLastQ ? colors.primaryForeground : colors.foreground }]}>
            {isLastQ ? "Submit" : "Next"}
          </Text>
          <Feather
            name={isLastQ ? "check" : "arrow-right"}
            size={20}
            color={isLastQ ? colors.primaryForeground : colors.foreground}
          />
        </TouchableOpacity>
      </View>

      {/* Anti-camera glance overlay — moving diagonal bands confuse autofocus */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Set 1: 5 bands, fast (1.7s) moving down-right */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View
            key={`a${i}`}
            style={{
              position: "absolute",
              top: -600,
              left: -600,
              width: 2400,
              height: i % 2 === 0 ? 2 : 1,
              backgroundColor: "rgba(255,255,255,0.055)",
              transform: [
                { rotate: "42deg" },
                {
                  translateY: glanceAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [i * 140, i * 140 + 200],
                  }),
                },
              ],
            }}
          />
        ))}
        {/* Set 2: 4 bands, slower (2.3s) moving opposite offset */}
        {[0, 1, 2, 3].map((i) => (
          <Animated.View
            key={`b${i}`}
            style={{
              position: "absolute",
              top: -600,
              left: -600,
              width: 2400,
              height: 1,
              backgroundColor: "rgba(200,200,255,0.04)",
              transform: [
                { rotate: "48deg" },
                {
                  translateY: glanceAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [i * 180 + 60, i * 180 + 60 - 180],
                  }),
                },
              ],
            }}
          />
        ))}
        {/* Set 3: 3 wide shimmer bands, fastest (1.1s) */}
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={`c${i}`}
            style={{
              position: "absolute",
              top: -600,
              left: -600,
              width: 2400,
              height: 6,
              backgroundColor: "rgba(255,255,255,0.018)",
              transform: [
                { rotate: "38deg" },
                {
                  translateY: glanceAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [i * 260 + 80, i * 260 + 80 + 260],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>

      {/* User ID watermark — animated drift defeats external camera autofocus */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateX: wmX }, { translateY: wmY }] },
        ]}
        pointerEvents="none"
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Text
            key={`wm${i}`}
            selectable={false}
            style={{
              position: "absolute",
              top: i * 150 - 60,
              left: -80,
              width: 700,
              color: "rgba(120,120,120,0.08)",
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 3,
              transform: [{ rotate: "-30deg" }],
            }}
          >
            {((meData as any)?.uid ?? "RankYatra") + "   "}
            {((meData as any)?.uid ?? "RankYatra") + "   "}
            {((meData as any)?.uid ?? "RankYatra")}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  qCounter: {},
  qNum: { fontSize: 15, fontWeight: "700" },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  timerText: { fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  submitSmall: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  submitSmallText: { fontSize: 13, fontWeight: "700" },
  progressBar: { height: 4 },
  progressFill: { height: 4 },
  qTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
  },
  qTimerLabel: { fontSize: 11, fontWeight: "600", width: 90 },
  qTimerBar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  qTimerFill: { height: 8, borderRadius: 4 },
  qTimerSec: { fontSize: 13, fontWeight: "800", width: 28, textAlign: "right", fontVariant: ["tabular-nums"] },
  liveStats: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  liveStatItem: { flex: 1, alignItems: "center", gap: 2 },
  liveStatNum: { fontSize: 16, fontWeight: "900" },
  liveStatLabel: { fontSize: 10, fontWeight: "600" },
  liveStatDivider: { width: 1, marginVertical: 4 },
  questionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  questionNum: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  questionText: { fontSize: 17, fontWeight: "700", lineHeight: 24 },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetter: { fontSize: 14, fontWeight: "800" },
  optionText: { flex: 1, fontSize: 15, lineHeight: 20 },
  navFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  navBtnText: { fontSize: 14, fontWeight: "700" },
  dotRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  alreadyDoneIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  alreadyDoneTitle: { fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  alreadyDoneSub: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  alreadyDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    width: "100%",
    marginBottom: 12,
  },
  alreadyDoneBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  alreadyDoneBtnOutline: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: "100%",
    borderWidth: 1.5,
  },
  alreadyDoneBtnOutlineText: { fontSize: 15, fontWeight: "700" },
  submitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  submitOverlayCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    minWidth: 220,
  },
  submitOverlayTitle: { fontSize: 22, fontWeight: "800" },
  submitOverlayText: { fontSize: 14 },
});
