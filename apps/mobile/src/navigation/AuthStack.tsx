import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { SignInScreen } from "../screens/auth/SignInScreen";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  InviteAcceptance: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Section 5.1 — unauthenticated stack. SignIn is wired to real Cognito (SPEC.md §2/§8 dev pool);
// SignUp and InviteAcceptance (deep link from an email/SMS invite) are still placeholders.
export function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: "Autentificare" }} />
      <Stack.Screen name="SignUp" options={{ title: "Cont nou" }}>
        {() => <PlaceholderScreen name="SignUp" />}
      </Stack.Screen>
      <Stack.Screen name="InviteAcceptance" options={{ title: "Invitație" }}>
        {() => <PlaceholderScreen name="InviteAcceptance" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
