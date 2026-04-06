import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  registerAlertSetter,
  unregisterAlertSetter,
  type AppAlertButton,
  type AppAlertConfig,
  type AlertType,
} from "@/utils/alert";

type AlertState = AppAlertConfig & { visible: boolean };

const TYPE_CONFIG: Record<
  AlertType,
  { icon: string; color: string; bgTint: string }
> = {
  success: { icon: "🎉", color: "#22c55e", bgTint: "#22c55e12" },
  error: { icon: "❌", color: "#ef4444", bgTint: "#ef444412" },
  warning: { icon: "⚠️", color: "#f59e0b", bgTint: "#f59e0b12" },
  confirm: { icon: "🤔", color: "#f97316", bgTint: "#f9731612" },
  info: { icon: "ℹ️", color: "#6366f1", bgTint: "#6366f112" },
};

export default function AppAlert() {
  const colors = useColors();
  const [state, setState] = useState<AlertState>({ visible: false, title: "" });
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    registerAlertSetter(setState as any);
    return () => unregisterAlertSetter();
  }, []);

  useEffect(() => {
    if (state.visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 160,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [state.visible]);

  const dismiss = (btn?: AppAlertButton) => {
    setState((s) => ({ ...s, visible: false }));
    if (btn?.onPress) {
      setTimeout(btn.onPress, 200);
    }
  };

  const type: AlertType = state.type ?? "info";
  const { icon, color, bgTint } = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const buttons = state.buttons ?? [{ text: "OK" }];

  const getPrimaryBtnStyle = (btn: AppAlertButton) => {
    if (btn.style === "cancel") {
      return [
        styles.btn,
        { borderColor: colors.border, borderWidth: 1.5, backgroundColor: "transparent" },
      ];
    }
    if (btn.style === "destructive") {
      return [styles.btn, { backgroundColor: "#ef4444" }];
    }
    return [styles.btn, { backgroundColor: color }];
  };

  const getPrimaryBtnTextStyle = (btn: AppAlertButton) => {
    if (btn.style === "cancel") {
      return [styles.btnText, { color: colors.mutedForeground }];
    }
    return [styles.btnText, { color: "#fff" }];
  };

  return (
    <Modal
      transparent
      visible={state.visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismiss()}
    >
      <TouchableWithoutFeedback onPress={() => dismiss()}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          {/* Icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: bgTint }]}>
            <Text style={styles.iconEmoji}>{icon}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {state.title}
          </Text>

          {/* Message */}
          {state.message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>
              {state.message}
            </Text>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Buttons */}
          <View
            style={[
              styles.btnRow,
              buttons.length === 1 && styles.btnRowSingle,
            ]}
          >
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[getPrimaryBtnStyle(btn), buttons.length > 1 && styles.btnFlex]}
                onPress={() => dismiss(btn)}
                activeOpacity={0.8}
              >
                <Text style={getPrimaryBtnTextStyle(btn)} numberOfLines={1}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  centeredView: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    padding: 28,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    width: "100%",
    marginVertical: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btnRowSingle: {
    justifyContent: "center",
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
