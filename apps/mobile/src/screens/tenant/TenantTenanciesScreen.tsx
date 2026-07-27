import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { Toggle } from "../../components/Toggle";
import {
  formatPropertyLocalityLine,
  formatPropertyStreetLine,
  unitTypeLabel,
  usePortfolioStore,
  utilityTypeLabel,
  utilityUnitLabel,
} from "../../context/portfolioStore";
import type { MyTenancy, TenantType } from "../../context/portfolioStore";
import { validateCUI } from "../../validators/romanianFiscalId";

const TENANT_TYPES: [{ value: TenantType; label: string }, { value: TenantType; label: string }] = [
  { value: "INDIVIDUAL", label: "Persoană Fizică" },
  { value: "COMPANY", label: "Firmă" },
];

// Section 4.4, phase 2 — the tenant side of linking a tenancy is real now: entering the code calls
// services/tenancies' POST /tenancies/claim (creates a tenancy_membership on this user server-side,
// derives contract_type from the unit's legal_entity.type × the tenant_type picked here), and
// "Chiriile mele" is populated from GET /tenancies/mine — a separate `myTenancies` state slice
// (portfolioStore.ts), not the owner-scoped `tenancies`/`properties` arrays a real tenant (no
// account_membership at all) could never fetch. `units` is the one exception read from that
// owner-scoped state here too, purely to show utilities+prices — works today because this session's
// test account is both Owner and Tenant of the same unit (so `units` is already populated from the
// Owner side's own `fetchPortfolio()`); a genuinely separate tenant (different login, no account at
// all) would see nothing there, same limitation as before, not fixed by this — `unit_utilities` still
// has no backend endpoint, `GET /tenancies/mine` still can't return them for a real tenant.
//
// Same pinned-header pattern as the Owner CRUD screens (§4.3): the "+ Asociază chirie" trigger (or the
// open code form) stays fixed above a hairline divider, while "Chiriile mele" scrolls underneath it.
export function TenantTenanciesScreen() {
  const myTenancies = usePortfolioStore((state) => state.myTenancies);
  const myTenanciesLoading = usePortfolioStore((state) => state.myTenanciesLoading);
  const myTenanciesError = usePortfolioStore((state) => state.myTenanciesError);
  const fetchMyTenancies = usePortfolioStore((state) => state.fetchMyTenancies);
  const claimTenancy = usePortfolioStore((state) => state.claimTenancy);
  const units = usePortfolioStore((state) => state.units);

  useEffect(() => {
    fetchMyTenancies();
  }, [fetchMyTenancies]);

  const [formOpen, setFormOpen] = useState(false);
  const [associationCode, setAssociationCode] = useState("");
  const [tenantType, setTenantType] = useState<TenantType | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyCui, setCompanyCui] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompany = tenantType === "COMPANY";
  const cuiValid = !isCompany || validateCUI(companyCui);
  const codeValid = associationCode.trim().length > 0;
  const formValid =
    codeValid && tenantType !== null && (!isCompany || (companyName.trim().length > 0 && cuiValid));

  const resetForm = () => {
    setFormOpen(false);
    setAssociationCode("");
    setTenantType(null);
    setCompanyName("");
    setCompanyCui("");
    setError(null);
  };

  const handleAssociate = async () => {
    if (!formValid || !tenantType) return;
    setError(null);
    setSubmitting(true);
    try {
      await claimTenancy(
        tenantType === "COMPANY"
          ? {
              associationCode,
              tenantType: "COMPANY",
              tenantCompanyName: companyName.trim(),
              tenantCompanyCui: companyCui.trim(),
            }
          : { associationCode, tenantType: "INDIVIDUAL" },
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut asocia chiria");
    } finally {
      setSubmitting(false);
    }
  };

  const propertiesWithTenancies = Array.from(
    new Map(myTenancies.map((tenancy) => [tenancy.property.id, tenancy.property])).values(),
  );

  const renderTenancyTile = (tenancy: MyTenancy, index: number) => {
    // Live lookup, not a snapshot — see the module comment above for why `units` has data here at
    // all (only true for this self-testing setup) and why it updates automatically when the owner
    // changes a utility in Portofoliu (same shared portfolioStore, no separate sync needed).
    const unit = units.find((u) => u.id === tenancy.unit.id);
    const enabledUtilities = unit?.utilities.filter((utility) => utility.enabled) ?? [];

    return (
      <View
        key={tenancy.id}
        style={[localStyles.tenancyListRow, index > 0 && localStyles.tenancyListRowDivider]}
      >
        <View style={localStyles.titleRow}>
          <View style={localStyles.unitInfo}>
            <Text style={localStyles.optionText}>{tenancy.unit.label}</Text>
            <Text style={localStyles.unitTypeCaption}>{unitTypeLabel(tenancy.unit.type)}</Text>
          </View>
          <Text style={localStyles.unitStatusAssociated}>Asociată</Text>
        </View>
        <View style={localStyles.tileDivider} />
        <Text style={localStyles.entityCaption}>Data început: {tenancy.startDate}</Text>
        <Text style={localStyles.entityCaption}>
          Cost chirie (lunar): {tenancy.rentAmount} {tenancy.rentCurrency}
        </Text>
        {enabledUtilities.length > 0 ? (
          <>
            <View style={localStyles.tileDivider} />
            <View style={localStyles.utilitiesBlock}>
              {enabledUtilities.map((utility) => (
                <Text key={utility.type} style={localStyles.utilityCaption}>
                  {utilityTypeLabel(utility.type)}: {utility.price.toFixed(2).replace(".", ",")}{" "}
                  {utilityUnitLabel(utility.type)}
                </Text>
              ))}
            </View>
          </>
        ) : null}
        {tenancy.associationCode ? (
          <>
            <View style={localStyles.tileDivider} />
            <Text style={localStyles.tenancyCode}>Cod de asociere: {tenancy.associationCode}</Text>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <FormScreen
      contentContainerStyle={[styles.container, styles.containerHeaderTop]}
      showBrand={false}
      longForm
      header={
        <>
          {formOpen ? (
            <View style={localStyles.card}>
              <Text style={styles.sectionLabel}>Cod de asociere</Text>
              <TextInput
                style={styles.input}
                placeholder="Cod primit de la proprietar"
                autoCapitalize="characters"
                value={associationCode}
                onChangeText={setAssociationCode}
              />
              <Text style={styles.caption}>
                Proprietarul generează acest cod când creează chiria pentru unitatea ta.
              </Text>

              <Text style={styles.sectionLabel}>Tip chiriaș</Text>
              <Toggle options={TENANT_TYPES} value={tenantType} onChange={setTenantType} fullWidth />

              {isCompany ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Denumire firmă"
                    value={companyName}
                    onChangeText={setCompanyName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="CUI"
                    autoCapitalize="characters"
                    value={companyCui}
                    onChangeText={setCompanyCui}
                  />
                  {companyCui.length > 0 && !cuiValid ? <Text style={styles.error}>CUI invalid</Text> : null}
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={localStyles.row}>
                <TouchableOpacity onPress={handleAssociate} disabled={!formValid || submitting}>
                  <Text style={!formValid || submitting ? localStyles.actionMuted : localStyles.action}>
                    Asociază
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetForm}>
                  <Text style={localStyles.actionMuted}>Anulează</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.sectionTrigger} onPress={() => setFormOpen(true)}>
              <Text style={styles.sectionTriggerText}>+ Asociază chirie</Text>
            </TouchableOpacity>
          )}
          <View style={localStyles.sectionDivider} />
        </>
      }
    >
      <Text style={styles.sectionLabel}>Chiriile mele</Text>

      {myTenancies.length === 0 && myTenanciesLoading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : myTenancies.length === 0 && myTenanciesError ? (
        <Text style={styles.error}>{myTenanciesError}</Text>
      ) : myTenancies.length === 0 ? (
        <Text style={styles.hint}>Nu ești asociat cu nicio chirie încă.</Text>
      ) : (
        propertiesWithTenancies.map((property) => (
          <View key={property.id} style={localStyles.propertyGroup}>
            <Text style={localStyles.propertyAddress}>{formatPropertyStreetLine(property)}</Text>
            <Text style={localStyles.propertyLocality}>{formatPropertyLocalityLine(property)}</Text>
            <View style={localStyles.tenancyList}>
              {myTenancies
                .filter((tenancy) => tenancy.property.id === property.id)
                .map((tenancy, index) => renderTenancyTile(tenancy, index))}
            </View>
          </View>
        ))
      )}
    </FormScreen>
  );
}

const localStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  action: { color: "#1a73e8", fontWeight: "600" },
  actionMuted: { color: "#8e8e93", fontWeight: "600" },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#ccc", marginTop: 16 },
  propertyGroup: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 8,
    backgroundColor: "#fff",
  },
  propertyAddress: { fontSize: 16, fontWeight: "600" },
  propertyLocality: { fontSize: 13, color: "#8e8e93", marginTop: -4 },
  tenancyList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", marginTop: 4 },
  tenancyListRow: { padding: 12, gap: 4 },
  tenancyListRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  // Matches OwnerTenanciesScreen's own optionText/tenancyCode exactly. tenancyCode has no marginTop
  // of its own for the same reason as utilitiesBlock/tileDivider below: `tenancyListRow`'s `gap: 4`
  // already spaces it from its neighbor.
  optionText: { fontSize: 16, fontWeight: "600" },
  unitTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  entityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  tenancyCode: { fontSize: 12, fontWeight: "700" },
  // Same hairline as OwnerTenanciesScreen's own tileDivider, between each labeled group in the tile
  // (label/subtip → date/cost → utilities → cod asociere).
  tileDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#ccc" },
  // No marginTop of its own — `tenancyListRow`'s own `gap: 4` already spaces every direct child
  // sibling evenly (titleRow, date, rent, this block, the code line); adding a second margin on top
  // of that gap was what made the utilities block sit noticeably further from the rent line than
  // every other line was from its neighbor.
  utilitiesBlock: {},
  // Same size/color as `entityCaption` (date/rent lines) — was 11px before, one size smaller than
  // its neighbors for no reason, which read as a font mismatch between "Cost chirie" and the
  // utility lines right under it.
  utilityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 1 },
  // Same "label/subtip + status badge" row as OwnerTenanciesScreen's titleRow/unitInfo, same green
  // as its unitStatusAssociated — this tile is always "Asociată" (this list only ever holds claimed
  // tenancies), but shown for visual consistency with the Owner side.
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unitInfo: { flex: 1 },
  unitStatusAssociated: { color: "#1a9e5c", fontSize: 12, fontWeight: "600" },
});
