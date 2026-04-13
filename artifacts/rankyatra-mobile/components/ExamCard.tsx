import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import type { Exam } from "@workspace/api-client-react";

interface ExamCardProps {
  exam: Exam;
  onPress: () => void;
  isRegistered?: boolean;
  hasSubmitted?: boolean;
}

function getTimeStatus(startTime: string, endTime: string) {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (now < start) {
    const diffMs = start - now;
    const totalSecs = Math.floor(diffMs / 1000);
    const secs = totalSecs % 60;
    const mins = Math.floor(totalSecs / 60) % 60;
    const hrs = Math.floor(totalSecs / 3600) % 24;
    const days = Math.floor(totalSecs / 86400);
    let label = "";
    if (days > 0) label = `In ${days}d ${hrs}h ${mins}m ${secs}s`;
    else if (hrs > 0) label = `In ${hrs}h ${mins}m ${secs}s`;
    else if (mins > 0) label = `In ${mins}m ${secs}s`;
    else label = `In ${secs}s`;
    return { label, status: "upcoming" as const };
  }
  if (now >= start && now <= end) return { label: "LIVE NOW", status: "live" as const };
  return { label: "Ended", status: "ended" as const };
}

const CATEGORY_COLORS: Record<string, string> = {
  SSC: "#2563eb",
  UPSC: "#7c3aed",
  Banking: "#059669",
  Railways: "#dc2626",
  Defence: "#d97706",
};

export function ExamCard({ exam, onPress, isRegistered, hasSubmitted }: ExamCardProps) {
  const colors = useColors();
  const { user } = useAuth();
  const isGuest = !user;
  const startTime = (exam as any).startTime ?? (exam as any).start_time ?? "";
  const endTime = (exam as any).endTime ?? (exam as any).end_time ?? "";

  const [timeInfo, setTimeInfo] = useState(() => getTimeStatus(startTime, endTime));

  useEffect(() => {
    const update = () => setTimeInfo(getTimeStatus(startTime, endTime));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime, endTime]);

  const catColor = CATEGORY_COLORS[exam.category ?? ""] ?? colors.secondary;
  const solutionPdfUrl = (exam as any).solutionPdfUrl ?? null;

  function renderActionBadge() {
    // Guest — not logged in
    if (isGuest) {
      return (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={(e) => {
            e.stopPropagation?.();
            router.push("/(auth)/login");
          }}
          activeOpacity={0.8}
        >
          <Feather name="log-in" size={12} color="#fff" />
          <Text style={styles.actionBtnText}>Login to Join</Text>
        </TouchableOpacity>
      );
    }

    // Not registered
    if (!isRegistered) {
      if (timeInfo.status === "upcoming") {
        // Can still join upcoming exams
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="user-plus" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>Join Now</Text>
          </TouchableOpacity>
        );
      }
      // Live or ended — can't join, show Not Joined
      return (
        <View style={[styles.actionBadge, { backgroundColor: colors.muted }]}>
          <Feather name="user-x" size={12} color={colors.mutedForeground} />
          <Text style={[styles.actionBadgeText, { color: colors.mutedForeground }]}>Not Joined</Text>
        </View>
      );
    }

    // Registered + submitted — show result/answer sheet
    if (hasSubmitted && timeInfo.status === "live") {
      // Exam still live — only See Result, no Answer Sheet yet
      return (
        <View style={styles.actionBtnGroup}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}/results`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="bar-chart-2" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>See Result</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasSubmitted && timeInfo.status === "ended") {
      // Exam ended — show both See Result + Answer Sheet
      return (
        <View style={styles.actionBtnGroup}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}/results`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="bar-chart-2" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>See Result</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}/answer-sheet`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="file-text" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>Answer Sheet</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Registered, live, not submitted — Start Exam
    if (timeInfo.status === "live") {
      return (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={(e) => {
            e.stopPropagation?.();
            router.push(`/exam/${exam.id}/take`);
          }}
          activeOpacity={0.8}
        >
          <Feather name="play" size={12} color="#fff" />
          <Text style={styles.actionBtnText}>Start Exam</Text>
        </TouchableOpacity>
      );
    }

    // Registered, ended, not submitted — Missed only
    if (timeInfo.status === "ended") {
      return (
        <View style={[styles.actionBadge, { backgroundColor: "#ef444420" }]}>
          <Feather name="x-circle" size={12} color="#ef4444" />
          <Text style={[styles.actionBadgeText, { color: "#ef4444" }]}>Missed</Text>
        </View>
      );
    }

    // Registered + upcoming (regardless of hasSubmitted for upcoming)
    return (
      <View style={[styles.actionBadge, { backgroundColor: colors.success + "20" }]}>
        <Feather name="check-circle" size={12} color={colors.success} />
        <Text style={[styles.actionBadgeText, { color: colors.success }]}>Joined</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      testID={`exam-card-${exam.id}`}
    >
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + "20" }]}>
          <Text style={[styles.categoryText, { color: catColor }]}>{exam.category}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                timeInfo.status === "live"
                  ? colors.success + "20"
                  : timeInfo.status === "ended"
                  ? colors.muted
                  : colors.saffronLight,
            },
          ]}
        >
          {timeInfo.status === "live" && (
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          )}
          <Text
            style={[
              styles.statusText,
              {
                color:
                  timeInfo.status === "live"
                    ? colors.success
                    : timeInfo.status === "ended"
                    ? colors.mutedForeground
                    : colors.saffron,
              },
            ]}
          >
            {timeInfo.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {exam.title}
      </Text>

      <View style={styles.dateRow}>
        <Feather name="calendar" size={12} color={colors.mutedForeground} />
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
          {timeInfo.status === "live"
            ? `Ends ${new Date(endTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${new Date(endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
            : `${new Date(startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${new Date(startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Feather name="award" size={14} color={colors.saffron} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            ₹{Number((exam as any).prizePool ?? (exam as any).prize_pool ?? 0).toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>20 min</Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name="tag" size={14} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            ₹{(exam as any).entryFee ?? (exam as any).entry_fee ?? 0}
          </Text>
        </View>
        <View style={{ marginLeft: "auto" }}>
          {/* Only show single-button badges (Joined / Not Joined / Register) in this row */}
          {!(hasSubmitted && (timeInfo.status === "ended" || timeInfo.status === "live")) && renderActionBadge()}
        </View>
      </View>

      {/* Submitted + live — only See Result (no Answer Sheet) */}
      {hasSubmitted && timeInfo.status === "live" && (
        <View style={styles.actionBtnRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}/results`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="bar-chart-2" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>See Result</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Submitted + ended — See Result + Answer Sheet both */}
      {hasSubmitted && timeInfo.status === "ended" && (
        <View style={styles.actionBtnRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}/results`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="bar-chart-2" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>See Result</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/exam/${exam.id}/answer-sheet`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="file-text" size={12} color="#fff" />
            <Text style={styles.actionBtnText}>Answer Sheet</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  actionBtnGroup: {
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 10,
  },
});
