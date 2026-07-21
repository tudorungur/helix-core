import { create } from "zustand";

import { getMyAccounts } from "../api/accounts";
import type { MyAccount } from "../api/accounts";

type AccountState = {
  accounts: MyAccount[];
  activeAccountId: string | null;
  status: "idle" | "loading" | "loaded" | "error";
  error: string | null;
  fetchAccounts: () => Promise<void>;
};

// Section 3.2 step 4 / Section 5.1 — every account-scoped request (services/properties) needs an
// accountId. Fetched once after sign-in (AppStack) via GET /accounts (services/accounts);
// `activeAccountId` defaults to the first one back — there's no multi-account switcher yet, same
// simplification the mock contextStore.ts already makes for Owner/Tenant.
export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  activeAccountId: null,
  status: "idle",
  error: null,
  fetchAccounts: async () => {
    set({ status: "loading", error: null });
    try {
      const accounts = await getMyAccounts();
      set({ accounts, activeAccountId: accounts[0]?.id ?? null, status: "loaded" });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : "Nu am putut încărca contul" });
    }
  },
}));
