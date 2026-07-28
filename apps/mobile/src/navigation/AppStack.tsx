import { useEffect } from "react";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";

import { useAccountStore } from "../context/accountStore";
import { useContextStore } from "../context/contextStore";
import type { AppContext } from "../context/contextStore";
import { usePortfolioStore } from "../context/portfolioStore";
import { ContextTitle } from "./ContextTitle";
import { NotificationsButton } from "./NotificationsButton";
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
// the stack route's own name ("Main") instead of an actual screen name. Both tab sets now land on
// "Home" (Acasă, 2026-07-28) instead of their previous first tab.
function getHeaderTitle(activeContext: AppContext, route: RouteProp<AppStackParamList, "Main">) {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  if (activeContext === "OWNER") {
    const key = (focusedRouteName ?? "Home") as keyof OwnerTabsParamList;
    return OWNER_TAB_LABELS[key] ?? OWNER_TAB_LABELS.Home;
  }
  const key = (focusedRouteName ?? "Home") as keyof TenantTabsParamList;
  return TENANT_TAB_LABELS[key] ?? TENANT_TAB_LABELS.Home;
}

// Section 5.1 — authenticated stack. A user with both an account_membership and a
// tenancy_membership switches between OwnerTabs/TenantTabs via the ContextTitle dropdown chip
// (headerLeft) instead of a separate "choose your context" screen (see contextStore.ts for why
// the available contexts are currently mocked — no backend to fetch real memberships from yet).
export function AppStack() {
  const activeContext = useContextStore((state) => state.activeContext);
  const fetchAccounts = useAccountStore((state) => state.fetchAccounts);
  const activeAccountId = useAccountStore((state) => state.activeAccountId);
  const fetchPortfolio = usePortfolioStore((state) => state.fetchPortfolio);

  // Resolves `activeAccountId` (Section 3.2 step 4) once per authenticated session — every
  // account-scoped request (Portofoliu/Setări's real API calls) needs it.
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Once an account resolves, load legal entities/properties/units/tenancies for it (Section 4.3/
  // 4.4) — and re-fetch every time the user switches back to Owner context, not just once at
  // login. Data the owner doesn't control can change server-side while they're on the Tenant tabs
  // (most notably: a tenant claiming an association_code flips that tenancy's status/contractType,
  // Section 4.4 phase 2) — without this, switching back showed stale pre-claim data indefinitely,
  // since nothing else in the app triggers a refetch.
  useEffect(() => {
    if (activeAccountId && activeContext === "OWNER") fetchPortfolio();
  }, [activeAccountId, activeContext, fetchPortfolio]);

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        options={({ route }) => ({
          title: getHeaderTitle(activeContext, route),
          headerLeft: () => <ContextTitle />,
          // NotificationsButton added 2026-07-28 — shared by both contexts, replacing what used to
          // be a Tenant-only tab (no real content behind it either way yet).
          headerRight: () => (
            <View style={styles.headerRight}>
              <NotificationsButton />
              <SignOutButton />
            </View>
          ),
        })}
      >
        {() => (activeContext === "OWNER" ? <OwnerTabs /> : <TenantTabs />)}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
});
