import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useContextStore } from "../context/contextStore";
import type { AppContext } from "../context/contextStore";
import { ContextTitle } from "./ContextTitle";
import { OWNER_TAB_LABELS, OwnerTabs } from "./OwnerTabs";
import type { OwnerTabsParamList } from "./OwnerTabs";
import { SignOutButton } from "./SignOutButton";
import { TENANT_TAB_LABELS, TenantTabs } from "./TenantTabs";
import type { TenantTabsParamList } from "./TenantTabs";

export type AppStackParamList = {
  Main: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

// OwnerTabs/TenantTabs hide their own headers — this is the single header for the whole
// authenticated app. ContextTitle/SignOutButton chips stay fixed left/right; the title tracks
// whichever tab is currently focused inside whichever tab navigator is mounted, so it never shows
// the stack route's own name ("Main") instead of an actual screen name.
function getHeaderTitle(activeContext: AppContext, route: RouteProp<AppStackParamList, "Main">) {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  if (activeContext === "OWNER") {
    const key = (focusedRouteName ?? "Portfolio") as keyof OwnerTabsParamList;
    return OWNER_TAB_LABELS[key] ?? OWNER_TAB_LABELS.Portfolio;
  }
  const key = (focusedRouteName ?? "MyTenancies") as keyof TenantTabsParamList;
  return TENANT_TAB_LABELS[key] ?? TENANT_TAB_LABELS.MyTenancies;
}

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
        options={({ route }) => ({
          title: getHeaderTitle(activeContext, route),
          headerLeft: () => <ContextTitle />,
          headerRight: () => <SignOutButton />,
        })}
      >
        {() => (activeContext === "OWNER" ? <OwnerTabs /> : <TenantTabs />)}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
