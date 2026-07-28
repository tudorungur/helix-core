import { LegalEntitiesEditor } from "../../components/LegalEntitiesEditor";
import { usePortfolioStore } from "../../context/portfolioStore";

// Section 5.1 — Setări tab. Entități legale live here now, not in a persistent cross-tab header
// (that version was removed — the filter/collapse behavior added complexity nobody wanted, and
// squeezing it above every OwnerTabs screen risked layout bugs). Owner-specific glue only — the
// actual form/list is `LegalEntitiesEditor` (extracted 2026-07-28, shared with
// TenantSettingsScreen once the two screens' field sets converged again): account-scoped
// `legalEntities`, "used by N unități" on delete, and the invoice-series field business forms get
// (owner-only — a tenant never issues an invoice through this app).
export function OwnerSettingsScreen() {
  const legalEntities = usePortfolioStore((state) => state.legalEntities);
  const units = usePortfolioStore((state) => state.units);
  const portfolioLoading = usePortfolioStore((state) => state.loading);
  const portfolioError = usePortfolioStore((state) => state.error);
  const addLegalEntity = usePortfolioStore((state) => state.addLegalEntity);
  const updateLegalEntity = usePortfolioStore((state) => state.updateLegalEntity);
  const deleteLegalEntity = usePortfolioStore((state) => state.deleteLegalEntity);

  return (
    <LegalEntitiesEditor
      entities={legalEntities}
      loading={portfolioLoading}
      error={portfolioError}
      showInvoiceSeries
      usageNoun="unitate/unități"
      countUsage={(id) => units.filter((unit) => unit.legalEntityId === id).length}
      onAdd={addLegalEntity}
      onUpdate={updateLegalEntity}
      onDelete={deleteLegalEntity}
    />
  );
}
