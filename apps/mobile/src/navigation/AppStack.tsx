import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ContextSwitcherScreen } from "../screens/ContextSwitcherScreen";
import { OwnerTabs } from "./OwnerTabs";
import { SignOutButton } from "./SignOutButton";
import { TenantTabs } from "./TenantTabs";

export type AppStackParamList = {
  ContextSwitcher: undefined;
  OwnerTabs: undefined;
  TenantTabs: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

// Section 5.1 — authenticated stack (Cognito session present). A user with both an
// account_membership and a tenancy_membership reaches both OwnerTabs and TenantTabs from the
// same ContextSwitcher — never merged into one screen.
export function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerRight: () => <SignOutButton /> }}>
      <Stack.Screen
        name="ContextSwitcher"
        component={ContextSwitcherScreen}
        options={{ title: "Helix" }}
      />
      <Stack.Screen name="OwnerTabs" component={OwnerTabs} options={{ title: "Proprietar" }} />
      <Stack.Screen name="TenantTabs" component={TenantTabs} options={{ title: "Chiriaș" }} />
    </Stack.Navigator>
  );
}
