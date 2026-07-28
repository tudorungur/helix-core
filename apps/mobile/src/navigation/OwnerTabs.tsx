import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { OwnerDashboardScreen } from "../screens/owner/OwnerDashboardScreen";
import { OwnerPortfolioScreen } from "../screens/owner/OwnerPortfolioScreen";
import { OwnerSettingsScreen } from "../screens/owner/OwnerSettingsScreen";
import { OwnerTenanciesScreen } from "../screens/owner/OwnerTenanciesScreen";

export type OwnerTabsParamList = {
  Home: undefined;
  Portfolio: undefined;
  Tenancies: undefined;
  Settings: undefined;
};

// Single source of truth for this tab set's Romanian names — used as both tabBarLabel and the
// AppStack header title (see getHeaderTitle in AppStack.tsx), so the two never drift apart.
// "Colaboratori" (Section 4.2) isn't its own tab — it folds into Settings instead (an administrative
// action, same category as fiscal data/ANAF/Netopia config) once that screen is actually built.
// Invoices/Maintenance no longer have their own tabs either (2026-07-28) — both were still pure
// placeholders with zero real content, so they were pulled out of the tab bar entirely and now
// surface as "În curând" entries on the new Home dashboard tab instead of occupying a slot with an
// empty screen. Promote them back to real tabs once they're actually built.
export const OWNER_TAB_LABELS: Record<keyof OwnerTabsParamList, string> = {
  Home: "Acasă",
  Portfolio: "Portofoliu",
  Tenancies: "Închirieri",
  Settings: "Setări",
};

const OWNER_TAB_ICONS: Record<keyof OwnerTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Portfolio: "business-outline",
  Tenancies: "key-outline",
  Settings: "settings-outline",
};

const Tab = createBottomTabNavigator<OwnerTabsParamList>();

function tabIconOptions(name: keyof OwnerTabsParamList) {
  return {
    tabBarLabel: OWNER_TAB_LABELS[name],
    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name={OWNER_TAB_ICONS[name]} color={color} size={size} />
    ),
  };
}

// Section 5.1 — visible when the active context is an account_membership. Home/Portfolio/
// Tenancies/Settings are all real. headerShown: false — AppStack renders the single header for the
// whole authenticated app (ContextTitle/SignOutButton chips + a title that tracks the focused tab),
// not each tab screen individually. No persistent header above the tabs anymore — an earlier
// `LegalEntityHeader` tried that (cross-tab legal-entity filter/collapse) and was removed: extra
// complexity nobody wanted, plus real risk of squeezing the Tab.Navigator's layout. Each tab is
// self-contained.
export function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={OwnerDashboardScreen} options={tabIconOptions("Home")} />
      <Tab.Screen name="Portfolio" component={OwnerPortfolioScreen} options={tabIconOptions("Portfolio")} />
      <Tab.Screen name="Tenancies" component={OwnerTenanciesScreen} options={tabIconOptions("Tenancies")} />
      <Tab.Screen name="Settings" component={OwnerSettingsScreen} options={tabIconOptions("Settings")} />
    </Tab.Navigator>
  );
}
