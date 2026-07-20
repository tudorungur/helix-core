import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { OwnerTenanciesScreen } from "../screens/owner/OwnerTenanciesScreen";

export type OwnerTabsParamList = {
  Portfolio: undefined;
  Collaborators: undefined;
  Tenancies: undefined;
  Invoices: undefined;
  Maintenance: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<OwnerTabsParamList>();

// Section 5.1 — visible when the active context is an account_membership. Tenancies is real
// (Section 4.3/4.4 minimal slice); the rest are still placeholders.
export function OwnerTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Portfolio">{() => <PlaceholderScreen name="Portfolio" />}</Tab.Screen>
      <Tab.Screen name="Collaborators">{() => <PlaceholderScreen name="Collaborators" />}</Tab.Screen>
      <Tab.Screen name="Tenancies" component={OwnerTenanciesScreen} />
      <Tab.Screen name="Invoices">{() => <PlaceholderScreen name="Invoices" />}</Tab.Screen>
      <Tab.Screen name="Maintenance">{() => <PlaceholderScreen name="Maintenance (Owner)" />}</Tab.Screen>
      <Tab.Screen name="Settings">{() => <PlaceholderScreen name="Settings" />}</Tab.Screen>
    </Tab.Navigator>
  );
}
