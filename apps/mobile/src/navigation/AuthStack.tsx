import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { SignInScreen } from "../screens/auth/SignInScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  InviteAcceptance: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Section 5.1 — unauthenticated stack. SignIn and SignUp are wired to real Cognito (SPEC.md §2/§8
// dev pool); InviteAcceptance (deep link from an email/SMS invite) is still a placeholder.
export function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: "Autentificare" }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: "Cont nou" }} />
      <Stack.Screen name="InviteAcceptance" options={{ title: "Invitație" }}>
        {() => <PlaceholderScreen name="InviteAcceptance" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
