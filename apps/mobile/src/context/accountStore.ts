import { create } from "zustand";

import { getMyAccounts } from "../api/accounts";
import type { MyAccount } from "../api/accounts";

type AccountState = {
  accounts: MyAccount[];
  activeAccountId: string | null;
  status: "idle" | "loading" | "loaded" | "error";
  error: string | null;
  fetchAccounts: () => Promise<void>;
  setActiveAccountId: (id: string) => void;
};

// Section 3.2 step 4 / Section 5.1 — every account-scoped request (services/properties) needs an
// accountId. Fetched once after sign-in (AppStack) via GET /accounts (services/accounts);
// `activeAccountId` defaults to the first one back. `setActiveAccountId` (added 2026-07-28, backing
// ContextTitle's own account switcher) lets the user pick a different one when they have more than
// one — AppStack's own `fetchPortfolio` effect already depends on `activeAccountId`, so switching
// triggers a real refetch with no extra wiring needed here.
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
  setActiveAccountId: (id) => set({ activeAccountId: id }),
}));
