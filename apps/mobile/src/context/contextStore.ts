import { create } from "zustand";

export type AppContext = "OWNER" | "TENANT";

type ContextState = {
  activeContext: AppContext;
  availableContexts: AppContext[];
  setActiveContext: (context: AppContext) => void;
  setAvailableContexts: (contexts: AppContext[]) => void;
  addContext: (context: AppContext) => void;
};

// Section 3.2 point 4 / Section 5.1 — which context(s) a user has should come from their real
// account_memberships + tenancy_memberships, but there's no backend yet to fetch those. For now
// this is seeded from the role picked at sign-up (SignUpScreen calls setAvailableContexts) for the
// current session only — it resets to the single-context default below on every fresh app launch,
// since nothing persists it. `addContext` exists for "Become a landlord" / linking a tenancy via an
// association code (Section 4.4) to extend the set later — neither of those flows calls it yet.
export const useContextStore = create<ContextState>((set) => ({
  activeContext: "OWNER",
  availableContexts: ["OWNER"],
  setActiveContext: (context) => set({ activeContext: context }),
  setAvailableContexts: (contexts) =>
    set({ availableContexts: contexts, activeContext: contexts[0] ?? "OWNER" }),
  addContext: (context) =>
    set((state) =>
      state.availableContexts.includes(context)
        ? state
        : { availableContexts: [...state.availableContexts, context] },
    ),
}));
