import { Text, TouchableOpacity } from "react-native";

import { useAuthStore } from "../auth/authStore";

// Rendered as headerRight on every screen in AppStack (Section 5.1), so sign-out is reachable
// the same way — top-right of the nav bar — from ContextSwitcher, OwnerTabs, and TenantTabs alike.
export function SignOutButton() {
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <TouchableOpacity onPress={() => signOut()} hitSlop={8}>
      <Text style={{ color: "#1a73e8", fontSize: 16 }}>Delogare</Text>
    </TouchableOpacity>
  );
}
