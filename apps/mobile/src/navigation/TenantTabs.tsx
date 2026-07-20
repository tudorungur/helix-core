import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { TenantTenanciesScreen } from "../screens/tenant/TenantTenanciesScreen";

export type TenantTabsParamList = {
  MyTenancies: undefined;
  ReadingWizard: undefined;
  MyInvoices: undefined;
  Maintenance: undefined;
  Notifications: undefined;
};

// Single source of truth for this tab set's Romanian names — used as both tabBarLabel and the
// AppStack header title (see getHeaderTitle in AppStack.tsx), so the two never drift apart.
export const TENANT_TAB_LABELS: Record<keyof TenantTabsParamList, string> = {
  MyTenancies: "Chiriile mele",
  ReadingWizard: "Citire index",
  MyInvoices: "Facturile mele",
  Maintenance: "Mentenanță",
  Notifications: "Notificări",
};

const TENANT_TAB_ICONS: Record<keyof TenantTabsParamList, keyof typeof Ionicons.glyphMap> = {
  MyTenancies: "home-outline",
  ReadingWizard: "speedometer-outline",
  MyInvoices: "receipt-outline",
  Maintenance: "construct-outline",
  Notifications: "notifications-outline",
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

// Section 5.1 — visible when the active context is a tenancy_membership. MyTenancies is real
// (Section 4.4 minimal slice); the rest are still placeholders. headerShown: false — AppStack
// renders the single header for the whole authenticated app (ContextTitle/SignOutButton chips +
// a title that tracks the focused tab), not each tab screen individually.
export function TenantTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="MyTenancies"
        component={TenantTenanciesScreen}
        options={tabIconOptions("MyTenancies")}
      />
      <Tab.Screen name="ReadingWizard" options={tabIconOptions("ReadingWizard")}>
        {() => <PlaceholderScreen name={TENANT_TAB_LABELS.ReadingWizard} />}
      </Tab.Screen>
      <Tab.Screen name="MyInvoices" options={tabIconOptions("MyInvoices")}>
        {() => <PlaceholderScreen name={TENANT_TAB_LABELS.MyInvoices} />}
      </Tab.Screen>
      <Tab.Screen name="Maintenance" options={tabIconOptions("Maintenance")}>
        {() => <PlaceholderScreen name={TENANT_TAB_LABELS.Maintenance} />}
      </Tab.Screen>
      <Tab.Screen name="Notifications" options={tabIconOptions("Notifications")}>
        {() => <PlaceholderScreen name={TENANT_TAB_LABELS.Notifications} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
