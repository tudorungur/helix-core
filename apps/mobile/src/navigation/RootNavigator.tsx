import { useEffect, useRef } from "react";
import { Animated, ActivityIndicator, View } from "react-native";
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

  return (
    <NavigationContainer>
      <StackSwitcher signedIn={status === "signedIn"} />
    </NavigationContainer>
  );
}

// A barely-there cross-fade between AuthStack and AppStack — react-navigation doesn't animate
// swapping which navigator is mounted (only transitions *within* a stack), so without this the
// sign-in/sign-out swap is an abrupt cut.
function StackSwitcher({ signedIn }: { signedIn: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [signedIn, opacity]);

  return (
    <Animated.View style={{ flex: 1, opacity }}>{signedIn ? <AppStack /> : <AuthStack />}</Animated.View>
  );
}
