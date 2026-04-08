import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const faqs = [
  {
    category: "General",
    items: [
      { q: "What is RankYatra?", a: "RankYatra is a live competitive exam platform where aspirants can join exams for ₹5, compete with thousands of students and top performers win real cash prizes. Exams are available for SSC, UPSC, Banking, Railways, Defence, NEET and IIT JEE." },
      { q: "Is this platform legal?", a: "Yes, RankYatra is 100% legal. It is a skill-based competition platform (not a lottery). Skill-based games for money are legal in India. We fully comply with Income Tax regulations." },
      { q: "How do I create an account?", a: "Click the Sign Up button, enter your name, email and password, verify the OTP — and you're done. Then add funds to your wallet and join your first exam!" },
    ],
  },
  {
    category: "Exams",
    items: [
      { q: "What is the exam entry fee?", a: "Most exams have an entry fee of ₹5. Some special exams may have different fees, which are clearly displayed on the exam page." },
      { q: "How long is each exam?", a: "Most exams are 20 minutes long. The exact duration is mentioned on each exam's page." },
      { q: "Can I join an exam after it has started?", a: "Yes, you can join as long as the exam is still live. However, the time that has already passed will count against your timer. It's better to join on time." },
      { q: "What if my internet disconnects during an exam?", a: "Your answers are auto-saved. You can continue after reconnecting. The exam timer will not pause." },
      { q: "Is there negative marking?", a: "It depends on the specific exam. If negative marking applies, it will be clearly mentioned on the exam page and exam screen." },
    ],
  },
  {
    category: "Payment & Wallet",
    items: [
      { q: "How do I add money to my wallet?", a: "Go to Dashboard → Wallet → Add Money. You can deposit via UPI (PhonePe, GPay, Paytm), Debit/Credit Card or Net Banking. Minimum deposit is ₹10." },
      { q: "How do I withdraw money?", a: "Go to Wallet → Withdraw Money → enter your UPI ID or bank details. KYC verification is required. Amount is credited to your account within 2–3 working days." },
      { q: "What is the minimum withdrawal amount?", a: "The minimum withdrawal amount is ₹100." },
      { q: "What if my deposit fails?", a: "If the amount was deducted from your payment gateway, an auto-refund is initiated within 5–7 working days. If not received, email rankyatra.in@gmail.com with a screenshot." },
    ],
  },
  {
    category: "KYC & Account",
    items: [
      { q: "Why is KYC required?", a: "KYC is mandatory for claiming prizes and withdrawals above ₹500. This is required under RBI and government norms. Verify using a government-issued ID (Aadhaar/PAN)." },
      { q: "How long does KYC approval take?", a: "Usually 24–48 hours. If it is still pending after 3 days, please contact support." },
      { q: "I forgot my password. What should I do?", a: "Go to the Login page → Forgot Password → enter your registered email → you will receive a reset link → set your new password." },
      { q: "How do I delete my account?", a: "Email rankyatra.in@gmail.com. Your account will be deleted within 30 days. Please withdraw any remaining balance first." },
    ],
  },
  {
    category: "Prizes & Results",
    items: [
      { q: "How are prizes distributed?", a: "Prize money is credited to the winners' RankYatra wallet within 24 hours of the exam result. From there, you can withdraw it to your bank account." },
      { q: "How is rank decided when scores are equal?", a: "In case of equal scores, the user who completed the exam in less time gets the better rank — exactly like government exams." },
      { q: "Is tax applicable on prizes?", a: "Yes, TDS is applicable on prizes above ₹10,000 as per Section 115BB of the Income Tax Act. You will receive a TDS certificate." },
      { q: "Can others see my result?", a: "Only your name and score are visible on the leaderboard. Detailed answers remain private." },
    ],
  },
];

function FAQItem({ q, a, colors }: { q: string; a: string; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setOpen(!open)}
      style={[
        styles.faqItem,
        {
          borderColor: open ? colors.primary + "50" : colors.border,
          backgroundColor: open ? colors.primary + "08" : colors.card,
        },
      ]}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{q}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={open ? colors.primary : colors.mutedForeground} />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{a}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function FAQScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Help & FAQ</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search questions..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="help-circle" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No results found</Text>
          </View>
        ) : (
          filtered.map(cat => (
            <View key={cat.category} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryBar, { backgroundColor: colors.primary }]} />
                <Text style={[styles.categoryTitle, { color: colors.foreground }]}>{cat.category}</Text>
              </View>
              <View style={styles.faqList}>
                {cat.items.map(item => (
                  <FAQItem key={item.q} q={item.q} a={item.a} colors={colors} />
                ))}
              </View>
            </View>
          ))
        )}

        <View style={[styles.contactCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
          <Text style={[styles.contactTitle, { color: colors.foreground }]}>Still have questions?</Text>
          <Text style={[styles.contactSub, { color: colors.mutedForeground }]}>Email us at rankyatra.in@gmail.com</Text>
        </View>
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  content: { padding: 16 },
  categoryBlock: { marginBottom: 24 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  categoryBar: { width: 4, height: 18, borderRadius: 2 },
  categoryTitle: { fontSize: 15, fontWeight: "800" },
  faqList: { gap: 8 },
  faqItem: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  faqHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  faqQ: { fontSize: 13.5, fontWeight: "600", lineHeight: 20 },
  faqA: { fontSize: 13, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 },
  emptyBox: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: "500" },
  contactCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: "center", marginTop: 8 },
  contactTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  contactSub: { fontSize: 13 },
});
