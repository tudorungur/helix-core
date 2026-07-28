import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";

// Placeholder slot (Notificări has no real content yet, Section 5.1) — moved out of the tab bar
// (2026-07-28, previously a Tenant-only tab) into a header icon shared by both Owner and Tenant
// contexts, next to SignOutButton. No screen or unread-count logic behind it yet; wire both up once
// Notificări is actually built.
export function NotificationsButton() {
  return (
    <TouchableOpacity style={styles.button} hitSlop={8}>
      <Ionicons name="notifications-outline" size={22} color="#1c1c1e" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 4 },
});
