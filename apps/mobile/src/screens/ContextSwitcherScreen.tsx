import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { AppStackParamList } from "../navigation/AppStack";

type Props = NativeStackScreenProps<AppStackParamList, "ContextSwitcher">;

// Section 5.1 — top-level, always reachable; shows every account_membership + tenancy_membership
// the user has. Real data (fetched via the API) is a later step — for now, a stub picker between
// the two contexts so both tab navigators are reachable.
export function ContextSwitcherScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alege contextul</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("OwnerTabs")}>
        <Text style={styles.buttonText}>Proprietar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("TenantTabs")}>
        <Text style={styles.buttonText}>Chiriaș</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
