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

const Tab = createBottomTabNavigator<TenantTabsParamList>();

// Section 5.1 — visible when the active context is a tenancy_membership. MyTenancies is real
// (Section 4.4 minimal slice); the rest are still placeholders.
export function TenantTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="MyTenancies" component={TenantTenanciesScreen} />
      <Tab.Screen name="ReadingWizard">{() => <PlaceholderScreen name="ReadingWizard" />}</Tab.Screen>
      <Tab.Screen name="MyInvoices">{() => <PlaceholderScreen name="MyInvoices" />}</Tab.Screen>
      <Tab.Screen name="Maintenance">{() => <PlaceholderScreen name="Maintenance (Tenant)" />}</Tab.Screen>
      <Tab.Screen name="Notifications">{() => <PlaceholderScreen name="Notifications" />}</Tab.Screen>
    </Tab.Navigator>
  );
}
