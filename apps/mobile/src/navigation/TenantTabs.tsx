import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { TenantDashboardScreen } from "../screens/tenant/TenantDashboardScreen";
import { TenantSettingsScreen } from "../screens/tenant/TenantSettingsScreen";
import { TenantTenanciesScreen } from "../screens/tenant/TenantTenanciesScreen";

export type TenantTabsParamList = {
  Home: undefined;
  MyTenancies: undefined;
  Settings: undefined;
};

// Single source of truth for this tab set's Romanian names — used as both tabBarLabel and the
// AppStack header title (see getHeaderTitle in AppStack.tsx), so the two never drift apart.
// ReadingWizard/MyInvoices/Maintenance/Notifications no longer have their own tabs (2026-07-28) —
// all four were still pure placeholders. ReadingWizard/MyInvoices/Maintenance now surface as "În
// curând" entries on the new Home dashboard tab instead of occupying a slot with an empty screen;
// Notifications moved to a header bell icon (NotificationsButton, shared with Owner context) since
// it isn't tab-worthy content, just a status indicator. Promote any of them back to a real tab once
// actually built.
export const TENANT_TAB_LABELS: Record<keyof TenantTabsParamList, string> = {
  Home: "Acasă",
  MyTenancies: "Chiriile mele",
  Settings: "Setări",
};

const TENANT_TAB_ICONS: Record<keyof TenantTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  MyTenancies: "key-outline",
  Settings: "settings-outline",
};

const Tab = createBottomTabNavigator<TenantTabsParamList>();

function tabIconOptions(name: keyof TenantTabsParamList) {
  return {
    tabBarLabel: TENANT_TAB_LABELS[name],
    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name={TENANT_TAB_ICONS[name]} color={color} size={size} />
    ),
  };
}

// Section 5.1 — visible when the active context is a tenancy_membership. All three tabs are real.
// headerShown: false — AppStack renders the single header for the whole authenticated app
// (ContextTitle/SignOutButton chips + a title that tracks the focused tab), not each tab screen
// individually.
export function TenantTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={TenantDashboardScreen} options={tabIconOptions("Home")} />
      <Tab.Screen
        name="MyTenancies"
        component={TenantTenanciesScreen}
        options={tabIconOptions("MyTenancies")}
      />
      <Tab.Screen name="Settings" component={TenantSettingsScreen} options={tabIconOptions("Settings")} />
    </Tab.Navigator>
  );
}
