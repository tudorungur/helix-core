import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { useAuthStore } from "../auth/authStore";

// Rendered as headerRight on AppStack's single screen (Section 5.1) — top-right of the nav bar,
// next to ContextTitle's chip on the left, regardless of whether OwnerTabs or TenantTabs is
// active. Same highlighted-chip language as ContextTitle, in the app's existing error/destructive
// red (formStyles.error) instead of blue — signals "this ends your session" at a glance.
export function SignOutButton() {
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <TouchableOpacity style={styles.chip} onPress={() => signOut()} hitSlop={8}>
      <Text style={styles.text}>Delogare</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#fdecea",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: { fontSize: 15, fontWeight: "600", color: "#d32f2f" },
});
