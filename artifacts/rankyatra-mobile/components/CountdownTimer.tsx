import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface CountdownTimerProps {
  endsAt: number;
  onExpire?: () => void;
  large?: boolean;
}

export function CountdownTimer({ endsAt, onExpire, large }: CountdownTimerProps) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const id = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const totalSecs = Math.floor(remaining / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  const isWarning = totalSecs < 60;
  const timerColor = isWarning ? colors.destructive : colors.foreground;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <View style={[styles.container, large && styles.containerLarge, { backgroundColor: isWarning ? colors.destructive + "15" : colors.accent }]}>
      <Text style={[styles.time, large && styles.timeLarge, { color: timerColor }]}>
        {pad(mins)}:{pad(secs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  containerLarge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  time: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  timeLarge: {
    fontSize: 40,
  },
});
