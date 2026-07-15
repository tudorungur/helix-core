import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

type Props = PropsWithChildren<{ contentContainerStyle?: StyleProp<ViewStyle> }>;

// Wraps every screen that uses the software keyboard. On iOS, automaticallyAdjustKeyboardInsets
// (RN 0.68+) hands keyboard-avoidance to the native UIScrollView machinery, which measures the
// *real* keyboard overlap and content layout itself — KeyboardAvoidingView's own "padding"
// measurement was consistently off here (likely thrown off by the native-stack header above it),
// leaving the focused field partially hidden and the submit button unreachable. Android has no
// such ScrollView API, so it still needs KeyboardAvoidingView; the two are kept mutually exclusive
// per platform since running both would double-adjust. keyboardShouldPersistTaps lets a button tap
// register without first having to dismiss the keyboard.
export function FormScreen({ children, contentContainerStyle }: Props) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "android" ? "height" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 24 },
});
