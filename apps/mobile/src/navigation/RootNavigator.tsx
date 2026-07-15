import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";

import { useAuthStore } from "../auth/authStore";
import { AppStack } from "./AppStack";
import { AuthStack } from "./AuthStack";

// Section 5.1 — AuthStack vs AppStack, gated on whether a Cognito session exists.
export function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (status === "checking") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <NavigationContainer>{status === "signedIn" ? <AppStack /> : <AuthStack />}</NavigationContainer>;
}
