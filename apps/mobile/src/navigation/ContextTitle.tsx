import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, TouchableOpacity } from "react-native";

import { useContextStore } from "../context/contextStore";
import type { AppContext } from "../context/contextStore";

const LABELS: Record<AppContext, string> = { OWNER: "Proprietar", TENANT: "Chiriaș" };
const CONTEXTS: AppContext[] = ["OWNER", "TENANT"];

// AppStack's headerLeft (Section 3.2 point 4 / Section 5.1) — a highlighted dropdown-style chip
// ("Proprietar ▾"), left-aligned. Tapping opens a native action sheet with both contexts — the
// standard iOS pattern for a workspace/persona switcher (Mail's account switcher, Slack's
// workspace picker), just rendered as a chip instead of the plain nav-bar title. Always offers
// both contexts, not just the ones the user has — picking one they don't yet prompts to activate
// it (§4.1 "Become a landlord" / §4.4 linking a tenancy via association code).
export function ContextTitle() {
  const activeContext = useContextStore((state) => state.activeContext);
  const availableContexts = useContextStore((state) => state.availableContexts);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const addContext = useContextStore((state) => state.addContext);

  const activate = (context: AppContext) => {
    if (context === activeContext) return;

    if (availableContexts.includes(context)) {
      setActiveContext(context);
      return;
    }

    // TODO: only flips the context — skips §4.1's legal-form+name capture (becoming an owner) or
    // §4.4's association-code entry (becoming a tenant, though TenantTenanciesScreen already
    // exists and is reachable once this adds the tenant context). Mocked, same as the rest of the
    // app pending a backend.
    Alert.alert(
      context === "OWNER" ? "Devii și Proprietar?" : "Devii și Chiriaș?",
      context === "OWNER"
        ? "Poți administra propriile proprietăți pe lângă contextul de Chiriaș."
        : "Te poți asocia cu un tenancy existent, pe lângă contextul de Proprietar.",
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Da",
          onPress: () => {
            addContext(context);
            setActiveContext(context);
          },
        },
      ],
    );
  };

  const openPicker = () => {
    const optionLabels = CONTEXTS.map((context) =>
      context === activeContext ? `${LABELS[context]} ✓` : LABELS[context],
    );

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Alege contextul",
          options: [...optionLabels, "Anulează"],
          cancelButtonIndex: optionLabels.length,
        },
        (index) => {
          if (index < CONTEXTS.length) activate(CONTEXTS[index]);
        },
      );
      return;
    }

    Alert.alert("Alege contextul", undefined, [
      ...CONTEXTS.map((context, index) => ({
        text: optionLabels[index],
        onPress: () => activate(context),
      })),
      { text: "Anulează", style: "cancel" as const },
    ]);
  };

  return (
    <TouchableOpacity style={styles.chip} onPress={openPicker} hitSlop={8}>
      <Text style={styles.text}>{LABELS[activeContext]}</Text>
      <Text style={styles.chevron}>▾</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eaf1fd",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: { fontSize: 15, fontWeight: "600", color: "#1a73e8" },
  chevron: { fontSize: 12, color: "#1a73e8" },
});
