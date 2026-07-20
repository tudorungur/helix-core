import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useContextStore } from "../context/contextStore";
import { ContextTitle } from "./ContextTitle";
import { OwnerTabs } from "./OwnerTabs";
import { SignOutButton } from "./SignOutButton";
import { TenantTabs } from "./TenantTabs";

export type AppStackParamList = {
  Main: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

// Section 5.1 — authenticated stack. A user with both an account_membership and a
// tenancy_membership switches between OwnerTabs/TenantTabs via the ContextTitle dropdown chip
// (headerLeft) instead of a separate "choose your context" screen (see contextStore.ts for why
// the available contexts are currently mocked — no backend to fetch real memberships from yet).
export function AppStack() {
  const activeContext = useContextStore((state) => state.activeContext);

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        options={{
          headerLeft: () => <ContextTitle />,
          headerRight: () => <SignOutButton />,
        }}
      >
        {() => (activeContext === "OWNER" ? <OwnerTabs /> : <TenantTabs />)}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
