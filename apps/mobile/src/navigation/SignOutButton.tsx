import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { formStyles } from "../components/formStyles";
import { useAuthStore } from "../auth/authStore";

// Rendered as headerRight on AppStack's single screen (Section 5.1) — top-right of the nav bar,
// next to ContextTitle's chip on the left, regardless of whether OwnerTabs or TenantTabs is
// active. Same highlighted-chip language as ContextTitle (shared formStyles.navChip shape), in the
// app's existing error/destructive red (formStyles.error) instead of blue — signals "this ends
// your session" at a glance.
export function SignOutButton() {
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <TouchableOpacity style={[formStyles.navChip, styles.chip]} onPress={() => signOut()} hitSlop={8}>
      <Text style={[formStyles.navChipText, styles.text]}>Delogare</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: "#fdecea" },
  text: { color: "#d32f2f" },
});
