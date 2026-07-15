import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

type Props = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  // Long, top-anchored forms (SignUp: 6-way picker + several conditional fields) need
  // automaticallyAdjustKeyboardInsets — KeyboardAvoidingView's own "padding" measurement was
  // consistently off there (likely thrown off by the native-stack header above it), leaving the
  // focused field partially hidden. Short, vertically-centered forms (SignIn) need the opposite:
  // automaticallyAdjustKeyboardInsets centers `justifyContent: "center"` content against an
  // inset-inflated content size rather than the visible viewport, leaving a large blank gap above
  // it once the keyboard is up. KeyboardAvoidingView's padding behavior doesn't have that problem
  // for short content — it was already correct before automaticallyAdjustKeyboardInsets replaced
  // it repo-wide for the SignUp fix. Default to the short-form (KeyboardAvoidingView) behavior.
  longForm?: boolean;
}>;

// Wraps every screen that uses the software keyboard. keyboardShouldPersistTaps lets a button tap
// register without first having to dismiss the keyboard. Also carries the "renta" wordmark, so
// every auth screen shows it in the same spot rather than each screen repeating its own header.
export function FormScreen({ children, contentContainerStyle, longForm = false }: Props) {
  const useNativeInsets = longForm && Platform.OS === "ios";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={useNativeInsets ? undefined : Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.container, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={useNativeInsets}
      >
        <Text style={styles.brand}>renta</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 24 },
  brand: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    color: "#1c1c1e",
    marginBottom: 20,
  },
});
