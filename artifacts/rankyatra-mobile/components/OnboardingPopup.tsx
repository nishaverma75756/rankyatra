import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

// Priority order: phone → preferences → kyc
interface PopupConfig {
  key: "phone" | "preferences" | "kyc";
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  cta: string;
  route: string;
}

const POPUPS: PopupConfig[] = [
  {
    key: "phone",
    icon: "phone",
    iconColor: "#7c3aed",
    iconBg: "#7c3aed18",
    title: "Add Your Phone Number",
    subtitle: "Your account is missing a phone number. Add it to secure your account and receive important updates.",
    cta: "Add Phone Number",
    route: "/change-credentials",
  },
  {
    key: "preferences",
    icon: "sliders",
    iconColor: "#f97316",
    iconBg: "#f9731618",
    title: "Set Exam Preferences",
    subtitle: "Tell us which exams you are preparing for. We will personalise your feed with the right content.",
    cta: "Set Preferences",
    route: "/exam-preferences",
  },
  {
    key: "kyc",
    icon: "shield",
    iconColor: "#059669",
    iconBg: "#05966918",
    title: "Verify Your Profile",
    subtitle: "Get a verified badge and build trust with other users. Complete your KYC to unlock full platform access.",
    cta: "Verify Now",
    route: "/verify",
  },
];

export default function OnboardingPopup() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [visible, setVisible] = useState(false);
  const [popup, setPopup] = useState<PopupConfig | null>(null);
  const shownThisSession = useRef(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only show once per app session
    if (shownThisSession.current || !user) return;

    // Determine which popup to show (first missing item in priority order)
    let toShow: PopupConfig | null = null;
    for (const p of POPUPS) {
      if (p.key === "phone" && !user.phone) { toShow = p; break; }
      if (p.key === "preferences" && (!user.preferences || user.preferences.length === 0)) { toShow = p; break; }
      if (p.key === "kyc" && (!user.verificationStatus || user.verificationStatus === "not_submitted")) { toShow = p; break; }
    }

    if (!toShow) return;

    // Delay 2 seconds after login to not overwhelm
    const timer = setTimeout(() => {
      shownThisSession.current = true;
      setPopup(toShow);
      setVisible(true);
      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 2000);

    return () => clearTimeout(timer);
  }, [user]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const handleCta = () => {
    dismiss();
    setTimeout(() => {
      if (popup) router.push(popup.route as any);
    }, 300);
  };

  if (!popup || !visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: popup.iconBg }]}>
            <Feather name={popup.icon as any} size={28} color={popup.iconColor} />
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: colors.foreground }]}>{popup.title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{popup.subtitle}</Text>

          {/* CTA button */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: popup.iconColor }]}
            onPress={handleCta}
            activeOpacity={0.85}
          >
            <Feather name={popup.icon as any} size={16} color="#fff" />
            <Text style={styles.ctaText}>{popup.cta}</Text>
          </TouchableOpacity>

          {/* Later */}
          <TouchableOpacity onPress={dismiss} style={styles.laterBtn} activeOpacity={0.7}>
            <Text style={[styles.laterText, { color: colors.mutedForeground }]}>Remind me later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, marginBottom: 24,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 10, lineHeight: 26,
  },
  subtitle: {
    fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28, paddingHorizontal: 8,
  },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    width: "100%", paddingVertical: 15, borderRadius: 16,
    justifyContent: "center", marginBottom: 12,
  },
  ctaText: {
    color: "#fff", fontSize: 16, fontWeight: "700",
  },
  laterBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
  },
  laterText: {
    fontSize: 14, fontWeight: "500",
  },
});
