import { useEffect } from "react";

import { LegalEntitiesEditor } from "../../components/LegalEntitiesEditor";
import { usePortfolioStore } from "../../context/portfolioStore";

// Section 5.1 — Chiriaș's own Setări tab, symmetric with OwnerSettingsScreen (2026-07-27
// consolidation: legal_entities is no longer account-only — a tenant needs the same reusable
// identity to claim a tenancy under, PF or a company they control, instead of retyping a name/CUI
// on every claim). Tenant-specific glue only — the actual form/list is `LegalEntitiesEditor`
// (extracted 2026-07-28): `userId`-scoped `myLegalEntities` (a tenant has no account at all), "used
// by N chirii" on delete, and no invoice-series field (a tenant never issues an invoice through
// this app — see [[project_helix_core_tax_compliance]]'s "Tenant's own VAT-payer status" note for
// why `vatPayer` stayed but `invoiceSeries` didn't).
export function TenantSettingsScreen() {
  const myLegalEntities = usePortfolioStore((state) => state.myLegalEntities);
  const myLegalEntitiesLoading = usePortfolioStore((state) => state.myLegalEntitiesLoading);
  const myLegalEntitiesError = usePortfolioStore((state) => state.myLegalEntitiesError);
  const fetchMyLegalEntities = usePortfolioStore((state) => state.fetchMyLegalEntities);
  const addMyLegalEntity = usePortfolioStore((state) => state.addMyLegalEntity);
  const updateMyLegalEntity = usePortfolioStore((state) => state.updateMyLegalEntity);
  const deleteMyLegalEntity = usePortfolioStore((state) => state.deleteMyLegalEntity);
  const myTenancies = usePortfolioStore((state) => state.myTenancies);

  useEffect(() => {
    fetchMyLegalEntities();
  }, [fetchMyLegalEntities]);

  return (
    <LegalEntitiesEditor
      entities={myLegalEntities}
      loading={myLegalEntitiesLoading}
      error={myLegalEntitiesError}
      showInvoiceSeries={false}
      usageNoun="chirie/chirii"
      countUsage={(id) => myTenancies.filter((tenancy) => tenancy.tenantLegalEntity.id === id).length}
      onAdd={addMyLegalEntity}
      onUpdate={updateMyLegalEntity}
      onDelete={deleteMyLegalEntity}
    />
  );
}
