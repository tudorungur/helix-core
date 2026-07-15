import * as SecureStore from "expo-secure-store";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import { create } from "zustand";

import { cognitoConfig } from "./cognitoConfig";

const userPool = new CognitoUserPool({
  UserPoolId: cognitoConfig.userPoolId,
  ClientId: cognitoConfig.userPoolClientId,
});

const SECURE_STORE_KEYS = {
  accessToken: "helix.accessToken",
  idToken: "helix.idToken",
  refreshToken: "helix.refreshToken",
} as const;

type AuthStatus = "checking" | "signedOut" | "signedIn";

type AuthState = {
  status: AuthStatus;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

// Real Cognito sign-in against the dev User Pool (SRP auth, per the app client's
// explicit_auth_flows — infra/modules/auth). Tokens land in expo-secure-store (SPEC.md §5.2),
// never AsyncStorage.
export const useAuthStore = create<AuthState>((set) => ({
  status: "checking",
  error: null,

  signIn: async (email, password) => {
    set({ error: null });
    return new Promise<void>((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          await SecureStore.setItemAsync(
            SECURE_STORE_KEYS.accessToken,
            session.getAccessToken().getJwtToken(),
          );
          await SecureStore.setItemAsync(
            SECURE_STORE_KEYS.idToken,
            session.getIdToken().getJwtToken(),
          );
          await SecureStore.setItemAsync(
            SECURE_STORE_KEYS.refreshToken,
            session.getRefreshToken().getToken(),
          );
          set({ status: "signedIn" });
          resolve();
        },
        onFailure: (err) => {
          set({ error: err.message ?? "Autentificare eșuată" });
          reject(err);
        },
      });
    });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.accessToken);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.idToken);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.refreshToken);
    set({ status: "signedOut" });
  },

  restoreSession: async () => {
    const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.accessToken);
    set({ status: accessToken ? "signedIn" : "signedOut" });
  },
}));
