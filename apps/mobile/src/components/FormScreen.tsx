import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

type Props = PropsWithChildren<{ contentContainerStyle?: StyleProp<ViewStyle> }>;

// Wraps every screen that uses the software keyboard. iOS's own "scroll the focused field into
// view" behavior is left alone (correct — the field being typed into should stay visible).
// KeyboardAvoidingView (behavior="padding") already shrinks the visible area by exactly the
// keyboard's height, so scrolling to the end always clears it — the ScrollView only needs a small
// fixed margin below the last element, not another keyboard-sized chunk stacked on top (that
// double-counts the keyboard height and leaves a large empty gap above it instead of hugging it).
// keyboardShouldPersistTaps lets a button tap register without first having to dismiss the keyboard.
export function FormScreen({ children, contentContainerStyle }: Props) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
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
