import * as SecureStore from "expo-secure-store";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserSession,
  CognitoUserPool,
  CognitoRefreshToken,
} from "amazon-cognito-identity-js";
import { create } from "zustand";

import { cognitoConfig } from "./cognitoConfig";

// Exported so SignUpScreen can drive the self-service signUp/confirmRegistration flow (a
// separate Cognito lifecycle from sign-in, so it isn't modeled as part of this store's status).
export const userPool = new CognitoUserPool({
  UserPoolId: cognitoConfig.userPoolId,
  ClientId: cognitoConfig.userPoolClientId,
});

const SECURE_STORE_KEYS = {
  accessToken: "helix.accessToken",
  idToken: "helix.idToken",
  refreshToken: "helix.refreshToken",
  username: "helix.username",
} as const;

// Used by src/api/client.ts to authorize every backend request — the ID token, not the access
// token: Cognito access tokens don't carry an `aud` claim (they have `client_id` instead), and the
// API Gateway HTTP API JWT authorizer (Section 6) checks `aud` specifically.
export async function getIdToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.idToken);
}

async function persistSession(session: CognitoUserSession, username: string) {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.accessToken, session.getAccessToken().getJwtToken());
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.idToken, session.getIdToken().getJwtToken());
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.refreshToken, session.getRefreshToken().getToken());
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.username, username);
}

// Cognito ID/access tokens expire after 1h; nothing previously refreshed them, so every request
// started failing with API Gateway's JWT-authorizer-level "Unauthorized" (rejected before the
// Lambda even runs — no invocation logged) once an hour had passed since sign-in, regardless of
// which endpoint was being called. Used by src/api/client.ts as a retry-once-on-401 fallback, not
// proactively — simpler, and the failure mode (one extra round-trip) is cheap.
export async function refreshIdToken(): Promise<string | null> {
  const [refreshTokenValue, username] = await Promise.all([
    SecureStore.getItemAsync(SECURE_STORE_KEYS.refreshToken),
    SecureStore.getItemAsync(SECURE_STORE_KEYS.username),
  ]);
  if (!refreshTokenValue || !username) return null;

  const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
  const refreshToken = new CognitoRefreshToken({ RefreshToken: refreshTokenValue });

  return new Promise((resolve) => {
    cognitoUser.refreshSession(refreshToken, async (err, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }
      await persistSession(session, username);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

type AuthStatus = "checking" | "signedOut" | "newPasswordRequired" | "signedIn";

type AuthState = {
  status: AuthStatus;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

// The CognitoUser instance mid-challenge (e.g. an admin-invited user on their first sign-in)
// lives here, not in the Zustand state — it's a stateful SDK object, not serializable data.
let pendingCognitoUser: CognitoUser | null = null;

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
          await persistSession(session, email);
          set({ status: "signedIn" });
          resolve();
        },
        onFailure: (err) => {
          set({ error: err.message ?? "Autentificare eșuată" });
          reject(err);
        },
        // Admin-invited users (Section 5.1 invite flow) start with a Cognito-issued temporary
        // password and must set a real one on first sign-in.
        newPasswordRequired: () => {
          pendingCognitoUser = cognitoUser;
          set({ status: "newPasswordRequired" });
          resolve();
        },
      });
    });
  },

  completeNewPassword: async (newPassword) => {
    set({ error: null });
    return new Promise<void>((resolve, reject) => {
      if (!pendingCognitoUser) {
        const err = new Error("Nicio autentificare în curs");
        set({ error: err.message });
        reject(err);
        return;
      }

      const username = pendingCognitoUser.getUsername();
      pendingCognitoUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: async (session) => {
          pendingCognitoUser = null;
          await persistSession(session, username);
          set({ status: "signedIn" });
          resolve();
        },
        onFailure: (err) => {
          set({ error: err.message ?? "Nu am putut seta noua parolă" });
          reject(err);
        },
      });
    });
  },

  signOut: async () => {
    pendingCognitoUser = null;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.accessToken);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.idToken);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.refreshToken);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.username);
    set({ status: "signedOut" });
  },

  restoreSession: async () => {
    const accessToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.accessToken);
    set({ status: accessToken ? "signedIn" : "signedOut" });
  },
}));
