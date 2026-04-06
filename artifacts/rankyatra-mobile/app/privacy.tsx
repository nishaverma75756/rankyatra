import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const sections = [
  {
    title: "1. What Data We Collect",
    content: `We collect the following data about you:\n• Account information: Name, email address, phone number\n• Identity verification (KYC): Government ID, PAN card (only if you wish to withdraw)\n• Payment data: UPI ID, bank details (to process payments)\n• Usage data: Which exams you took, scores, time spent, device/browser info\n• Technical data: IP address, cookies, log files`,
  },
  {
    title: "2. How We Use Your Data",
    content: `Your data is used for the following purposes:\n• Providing platform services (exams, results, prizes)\n• Managing your account and verifying identity\n• Processing payments and preventing fraud\n• Providing customer support\n• Improving the platform and developing new features\n• Complying with legal obligations (TDS, KYC norms)\n• Marketing emails (only with your permission)`,
  },
  {
    title: "3. Data Sharing",
    content: `We do not sell your personal data to any third party. Data is shared only with:\n• Payment gateways (Razorpay/Paytm) — to process payments\n• Cloud services (AWS/GCP) — to store data securely\n• Government authorities — when legally required\n• KYC verification service — to verify identity\n\nWe have data protection agreements with all of the above.`,
  },
  {
    title: "4. Data Storage & Security",
    content: `Your data is stored securely on India-based servers. Security measures include:\n• HTTPS encryption for all connections\n• Passwords stored with bcrypt encryption\n• Database in encrypted storage\n• Regular security audits\n• Limited employee access (need-to-know basis)\n\nNo system is 100% secure — if a breach occurs, we will notify you within 72 hours.`,
  },
  {
    title: "5. Cookies",
    content: `We use cookies to:\n• Keep you logged in\n• Remember your preferences\n• Analyze usage patterns (via Google Analytics)\n\nYou can disable cookies in your browser settings, but some features of the platform may not work properly.`,
  },
  {
    title: "6. Your Rights",
    content: `You have the following rights regarding your data:\n• Access: Request a copy of the data we hold about you\n• Correction: Request correction of incorrect data\n• Deletion: Request deletion of your account and data\n• Portability: Request your data in a portable format\n• Objection: Object to certain types of data processing\n\nTo exercise these rights, email privacy@rankyatra.in.`,
  },
  {
    title: "7. Data Retention",
    content: `We retain your data for as long as your account is active. After account closure:\n• Transaction data: retained for 7 years (legal requirement)\n• KYC documents: retained for 5 years (RBI regulations)\n• Other data: deleted within 30 days`,
  },
  {
    title: "8. Children's Privacy",
    content: `RankYatra is strictly for users aged 18 and above. We do not knowingly collect data from minors. If you believe a minor has created an account, please report it to support@rankyatra.in immediately.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. The date of the latest update is always shown at the top of this page.`,
  },
  {
    title: "10. Contact Us",
    content: `For privacy-related queries:\n📧 privacy@rankyatra.in\n🌐 www.rankyatra.in/privacy\n📍 RankYatra Technologies Pvt. Ltd., New Delhi, India`,
  },
];

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBadge, { backgroundColor: "#05966912", borderColor: "#05966930" }]}>
          <Feather name="shield" size={18} color="#059669" />
          <Text style={[styles.heroText, { color: "#059669" }]}>Last updated: April 2025</Text>
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          At RankYatra, we are committed to protecting your privacy. This policy explains how we collect, use and protect your personal data in compliance with the Information Technology Act and applicable Indian data protection laws.
        </Text>

        {sections.map((sec, i) => (
          <View key={i} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{sec.title}</Text>
            <Text style={[styles.sectionContent, { color: colors.mutedForeground }]}>{sec.content}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  heroText: { fontSize: 13, fontWeight: "600" },
  intro: { fontSize: 13.5, lineHeight: 21, marginBottom: 8 },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  sectionContent: { fontSize: 13.5, lineHeight: 21 },
});
