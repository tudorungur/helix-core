import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useContextStore } from "../context/contextStore";
import type { AppContext } from "../context/contextStore";

const LABELS: Record<AppContext, string> = { OWNER: "Proprietar", TENANT: "Chiriaș" };

// AppStack's headerLeft (Section 3.2 point 4 / Section 5.1). Always shows both contexts, not just
// the ones the user already has — tapping one they don't have yet prompts to activate it (§4.1
// "Become a landlord" / §4.4 linking a tenancy via association code) rather than hiding it, since
// growing into the other persona is a first-class action, not an edge case.
//
// TODO: confirming "become a landlord" here only flips the context — it skips §4.1's legal-form +
// name capture that a real new `account` needs. Fine for now (matches how much of this app is
// still mocked pending a backend), but that capture step still needs a real screen eventually.
export function ContextToggle() {
  const activeContext = useContextStore((state) => state.activeContext);
  const availableContexts = useContextStore((state) => state.availableContexts);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const addContext = useContextStore((state) => state.addContext);

  const handlePress = (context: AppContext) => {
    if (availableContexts.includes(context)) {
      setActiveContext(context);
      return;
    }

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
    <View style={styles.row}>
      {(Object.keys(LABELS) as AppContext[]).map((context) => (
        <TouchableOpacity
          key={context}
          style={[styles.option, activeContext === context && styles.optionActive]}
          onPress={() => handlePress(context)}
          hitSlop={4}
        >
          <Text style={[styles.text, activeContext === context && styles.textActive]}>
            {LABELS[context]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", backgroundColor: "#eee", borderRadius: 8, padding: 2 },
  option: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  optionActive: { backgroundColor: "#1a73e8" },
  text: { fontSize: 13, fontWeight: "600", color: "#333" },
  textActive: { color: "#fff" },
});
