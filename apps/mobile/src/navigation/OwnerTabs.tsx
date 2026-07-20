import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { OwnerPortfolioScreen } from "../screens/owner/OwnerPortfolioScreen";
import { OwnerSettingsScreen } from "../screens/owner/OwnerSettingsScreen";
import { OwnerTenanciesScreen } from "../screens/owner/OwnerTenanciesScreen";

export type OwnerTabsParamList = {
  Portfolio: undefined;
  Tenancies: undefined;
  Invoices: undefined;
  Maintenance: undefined;
  Settings: undefined;
};

// Single source of truth for this tab set's Romanian names — used as both tabBarLabel and the
// AppStack header title (see getHeaderTitle in AppStack.tsx), so the two never drift apart.
// "Colaboratori" (Section 4.2) isn't its own tab — 6 tabs was one over the usual bottom-bar limit,
// so it folds into Settings instead (an administrative action, same category as fiscal
// data/ANAF/Netopia config) once that screen is actually built.
export const OWNER_TAB_LABELS: Record<keyof OwnerTabsParamList, string> = {
  Portfolio: "Portofoliu",
  Tenancies: "Închirieri",
  Invoices: "Facturi",
  Maintenance: "Mentenanță",
  Settings: "Setări",
};

const OWNER_TAB_ICONS: Record<keyof OwnerTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Portfolio: "business-outline",
  Tenancies: "key-outline",
  Invoices: "receipt-outline",
  Maintenance: "construct-outline",
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

// Section 5.1 — visible when the active context is an account_membership. Portfolio (§4.3, just
// properties now — legal entities moved out), Tenancies (§4.4), and Settings (legal entities CRUD)
// are real; Invoices/Maintenance are still placeholders. headerShown: false — AppStack renders the
// single header for the whole authenticated app (ContextTitle/SignOutButton chips + a title that
// tracks the focused tab), not each tab screen individually. No persistent header above the tabs
// anymore — an earlier `LegalEntityHeader` tried that (cross-tab legal-entity filter/collapse) and
// was removed: extra complexity nobody wanted, plus real risk of squeezing the Tab.Navigator's
// layout. Each tab is now self-contained.
export function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Portfolio" component={OwnerPortfolioScreen} options={tabIconOptions("Portfolio")} />
      <Tab.Screen name="Tenancies" component={OwnerTenanciesScreen} options={tabIconOptions("Tenancies")} />
      <Tab.Screen name="Invoices" options={tabIconOptions("Invoices")}>
        {() => <PlaceholderScreen name={OWNER_TAB_LABELS.Invoices} />}
      </Tab.Screen>
      <Tab.Screen name="Maintenance" options={tabIconOptions("Maintenance")}>
        {() => <PlaceholderScreen name={OWNER_TAB_LABELS.Maintenance} />}
      </Tab.Screen>
      <Tab.Screen name="Settings" component={OwnerSettingsScreen} options={tabIconOptions("Settings")} />
    </Tab.Navigator>
  );
}
