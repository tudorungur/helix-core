import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useContextStore } from "../context/contextStore";
import type { AppContext } from "../context/contextStore";
import { ContextToggle } from "./ContextToggle";
import { OwnerTabs } from "./OwnerTabs";
import { SignOutButton } from "./SignOutButton";
import { TenantTabs } from "./TenantTabs";

export type AppStackParamList = {
  Main: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

const TITLES: Record<AppContext, string> = { OWNER: "Proprietar", TENANT: "Chiriaș" };

// Section 5.1 — authenticated stack. A user with both an account_membership and a
// tenancy_membership switches between OwnerTabs/TenantTabs via the header's ContextToggle instead
// of a separate "choose your context" screen (see contextStore.ts for why the available contexts
// are currently mocked — no backend to fetch real memberships from yet).
export function AppStack() {
  const activeContext = useContextStore((state) => state.activeContext);

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        options={{
          title: TITLES[activeContext],
          headerLeft: () => <ContextToggle />,
          headerRight: () => <SignOutButton />,
        }}
      >
        {() => (activeContext === "OWNER" ? <OwnerTabs /> : <TenantTabs />)}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
