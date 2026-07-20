import { Text, TouchableOpacity } from "react-native";

import { useAuthStore } from "../auth/authStore";

// Rendered as headerRight on AppStack's single screen (Section 5.1) — top-right of the nav bar,
// next to the ContextToggle on the left, regardless of whether OwnerTabs or TenantTabs is active.
export function SignOutButton() {
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <TouchableOpacity onPress={() => signOut()} hitSlop={8}>
      <Text style={{ color: "#1a73e8", fontSize: 16 }}>Delogare</Text>
    </TouchableOpacity>
  );
}
