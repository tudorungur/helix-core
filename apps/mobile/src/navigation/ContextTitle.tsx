import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formStyles } from "../components/formStyles";
import { useContextStore } from "../context/contextStore";
import type { AppContext } from "../context/contextStore";

const LABELS: Record<AppContext, string> = { OWNER: "Proprietar", TENANT: "Chiriaș" };
const CONTEXTS: AppContext[] = ["OWNER", "TENANT"];

// Rough native-stack header height (safe-area top + standard nav bar) — used only to anchor the
// dropdown panel below the chip; a few pixels off either way doesn't matter visually.
const HEADER_HEIGHT = 44;

// AppStack's headerLeft (Section 3.2 point 4 / Section 5.1) — a highlighted dropdown-style chip
// ("Proprietar ▾"), left-aligned. Tapping expands an in-place dropdown panel right under the chip
// (a transparent Modal + Pressable backdrop just to catch outside-taps, not a system action
// sheet/alert) — ActionSheetIOS/Alert.alert were tried first and replaced because they read as a
// full system overlay taking over the screen, not an in-place expansion. Always offers both
// contexts, not just the ones the user has — picking one they don't yet prompts to activate it
// (§4.1 "Become a landlord" / §4.4 linking a tenancy via association code).
export function ContextTitle() {
  const activeContext = useContextStore((state) => state.activeContext);
  const availableContexts = useContextStore((state) => state.availableContexts);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const addContext = useContextStore((state) => state.addContext);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const activate = (context: AppContext) => {
    setOpen(false);
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

  return (
    <>
      <TouchableOpacity
        style={[formStyles.navChip, styles.chip]}
        onPress={() => setOpen((current) => !current)}
        hitSlop={8}
      >
        <Text style={[formStyles.navChipText, styles.text]}>{LABELS[activeContext]}</Text>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </TouchableOpacity>
      {open ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={[styles.dropdown, { top: insets.top + HEADER_HEIGHT }]}>
              {CONTEXTS.map((context, index) => (
                <TouchableOpacity
                  key={context}
                  style={[styles.option, index > 0 && styles.optionDivider]}
                  onPress={() => activate(context)}
                >
                  <Text style={styles.optionText}>{LABELS[context]}</Text>
                  {context === activeContext ? <Text style={styles.optionCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eaf1fd" },
  text: { color: "#1a73e8" },
  chevron: { fontSize: 22, color: "#1a73e8" },
  backdrop: { flex: 1 },
  dropdown: {
    position: "absolute",
    left: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    overflow: "hidden",
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  optionText: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  optionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
});
