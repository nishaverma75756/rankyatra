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
    title: "1. Acceptance of Terms",
    content: `By using RankYatra, you agree to these Terms and Conditions set by RankYatra Technologies Pvt. Ltd. If you do not agree, please do not use the platform. These terms may be updated from time to time; changes will be published on the platform.`,
  },
  {
    title: "2. Eligibility",
    content: `You must be 18 years of age or older to use the platform. The platform is not intended for use in states where skill-based games are restricted (e.g. Andhra Pradesh, Telangana, Nagaland, etc.). You are responsible for verifying your own eligibility. Each user may only hold one account.`,
  },
  {
    title: "3. Our Services",
    content: `RankYatra is a skill-based competitive exam platform where users participate in exams by paying an entry fee. Top performers win cash prizes. This is a skill-based activity — the result depends on your knowledge and speed, not chance. We follow government-level exam patterns.`,
  },
  {
    title: "4. Account & Security",
    content: `You are responsible for keeping your account and password secure. Report any suspicious activity to support immediately. Account sharing is strictly prohibited. Providing false information may result in a permanent account ban. Creating multiple accounts may result in all accounts being banned.`,
  },
  {
    title: "5. Payment & Wallet",
    content: `You must add balance to your wallet to use the platform. The minimum deposit is ₹10. Entry fees are deducted when you join an exam. Prize money is credited to winners' wallets within 24 hours of the result. Wallet balance is non-transferable.`,
  },
  {
    title: "6. Refund Policy",
    content: `If an exam could not be completed due to a technical issue, the entry fee will be refunded. If you voluntarily left the exam or time ran out, no refund will be issued. Withdrawn wallet amounts are non-refundable. Deposited amounts in the wallet are not refunded except on account closure. On account closure, remaining wallet balance will be refunded within 7 working days.`,
  },
  {
    title: "7. Prizes & Taxes",
    content: `Prize distribution takes place after exam results are confirmed by the admin. TDS is applicable on prizes above ₹10,000 as per Section 115BB of the Income Tax Act. A TDS certificate will be issued. You are responsible for correctly reporting your prize income for tax purposes.`,
  },
  {
    title: "8. User Conduct",
    content: `Cheating, hacking, using bots or any unfair means is strictly prohibited and will result in a permanent account ban. Sharing offensive, abusive or illegal content is prohibited. Harassing other users is prohibited. Misusing the company name or brand is prohibited.`,
  },
  {
    title: "9. Responsible Gaming",
    content: `Although RankYatra is a skill-based platform, we encourage responsible gaming. Only spend what you can afford. If you feel you are exhibiting compulsive behaviour, contact help@rankyatra.in.`,
  },
  {
    title: "10. Intellectual Property",
    content: `All content on RankYatra — including question banks, platform design and branding — is the exclusive intellectual property of RankYatra Technologies Pvt. Ltd. You may not copy, reproduce or distribute our content without written permission.`,
  },
  {
    title: "11. Limitation of Liability",
    content: `The platform is provided "as is". We are not liable for technical issues beyond our control (internet failure, server downtime, etc.). Our maximum liability is limited to the entry fee paid for that specific exam.`,
  },
  {
    title: "12. Termination",
    content: `We reserve the right to suspend or permanently ban accounts that violate these terms. You can close your account at any time by emailing rankyatra.in@gmail.com.`,
  },
  {
    title: "13. Governing Law",
    content: `These terms are governed by the laws of India. Any disputes will be subject to the jurisdiction of courts in Delhi, India.`,
  },
  {
    title: "14. Contact Us",
    content: `For any questions about these terms:\n📧 rankyatra.in@gmail.com\n📞 +91 9006109415\n🌐 www.rankyatra.in\n📍 RankYatra Technologies Pvt. Ltd., 5/955, Viram Khand 5, Gomtinagar, Lucknow - 226010, Uttar Pradesh`,
  },
];

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Terms & Conditions</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBadge, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Feather name="file-text" size={18} color={colors.primary} />
          <Text style={[styles.heroText, { color: colors.primary }]}>Last updated: April 2025</Text>
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Please read these terms carefully before using RankYatra. By accessing or using our platform, you agree to be bound by these terms.
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
