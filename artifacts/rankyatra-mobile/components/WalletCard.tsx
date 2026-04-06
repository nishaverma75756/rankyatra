import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface WalletCardProps {
  balance: number | string;
}

export function WalletCard({ balance }: WalletCardProps) {
  const colors = useColors();
  const amt = Number(balance);

  return (
    <View style={[styles.card, { backgroundColor: colors.secondary }]}>
      <View style={styles.row}>
        <Feather name="credit-card" size={20} color={colors.saffron} />
        <Text style={[styles.label, { color: colors.saffron }]}>Wallet Balance</Text>
      </View>
      <Text style={[styles.amount, { color: "#ffffff" }]}>
        ₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  amount: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
