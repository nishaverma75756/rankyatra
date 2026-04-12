import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Stack, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/alert";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const MAX_PREFS = 5;

const CATEGORY_ICONS: Record<string, string> = {
  SSC: "📋",
  UPSC: "🏛️",
  Banking: "🏦",
  Railways: "🚂",
  Defence: "🛡️",
  NEET: "⚕️",
  "IIT JEE": "⚗️",
  BPSC: "📜",
  MPSC: "📜",
  RPSC: "📜",
  IBPS: "🏦",
  SBI: "🏦",
  RRB: "🚂",
  Police: "👮",
  Teaching: "📚",
  GATE: "🎓",
  CAT: "📊",
  CLAT: "⚖️",
  NDA: "🛡️",
  CDS: "🛡️",
};

export default function ExamPreferences() {
  const colors = useThemeColors();
  const { token, user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<string[]>(
    Array.isArray(user?.preferences) ? user.preferences : []
  );

  const { data: categories = [], isLoading: loadingCats } = useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/categories`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (prefs: string[]) => {
      const r = await fetch(`${BASE_URL}/api/me/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preferences: prefs }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to save preferences");
      return data;
    },
    onSuccess: (data) => {
      updateUser({ preferences: data.preferences });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      showSuccess("Preferences saved!");
      router.back();
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  const toggle = useCallback(
    (cat: string) => {
      setSelected((prev) => {
        if (prev.includes(cat)) return prev.filter((c) => c !== cat);
        if (prev.length >= MAX_PREFS) {
          showError(`You can select at most ${MAX_PREFS} preferences.`);
          return prev;
        }
        return [...prev, cat];
      });
    },
    []
  );

  const handleSave = () => saveMutation.mutate(selected);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Exam Preferences",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header info */}
        <View style={[styles.infoCard, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Select up to {MAX_PREFS} exam categories that interest you. These will be used to personalise your experience.
          </Text>
        </View>

        {/* Counter */}
        <View style={styles.counterRow}>
          <Text style={[styles.counterLabel, { color: colors.mutedForeground }]}>
            Selected
          </Text>
          <View style={[styles.counterBadge, { backgroundColor: selected.length === MAX_PREFS ? "#f97316" : colors.primary, }]}>
            <Text style={styles.counterBadgeText}>{selected.length} / {MAX_PREFS}</Text>
          </View>
        </View>

        {/* Category chips */}
        {loadingCats ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {categories.map((cat) => {
              const active = selected.includes(cat);
              const atMax = selected.length >= MAX_PREFS && !active;
              const icon = CATEGORY_ICONS[cat] ?? "📌";
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggle(cat)}
                  activeOpacity={0.75}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.card,
                      borderColor: active
                        ? colors.primary
                        : atMax
                        ? colors.border + "80"
                        : colors.border,
                      opacity: atMax ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={styles.chipEmoji}>{icon}</Text>
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: active ? "#fff" : colors.foreground },
                    ]}
                  >
                    {cat}
                  </Text>
                  {active && (
                    <Feather
                      name="check"
                      size={14}
                      color="#fff"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saveMutation.isPending ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saveMutation.isPending}
          activeOpacity={0.8}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save Preferences</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  counterLabel: { fontSize: 14, fontWeight: "600" },
  counterBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 14, fontWeight: "600" },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
