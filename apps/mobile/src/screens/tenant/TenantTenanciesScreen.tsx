import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import {
  formatPropertyLocalityLine,
  formatPropertyStreetLine,
  unitTypeLabel,
  usePortfolioStore,
  utilityTypeLabel,
  utilityUnitLabel,
} from "../../context/portfolioStore";
import type { Property, Tenancy, Unit } from "../../context/portfolioStore";

type TenancyEntry = { tenancy: Tenancy; unit: Unit | undefined; property: Property | undefined };

// Section 4.4, minimal slice — the tenant side of linking a tenancy: enter the association_code
// the owner generated (OwnerTenanciesScreen). No backend/tenancy_membership exists yet, but Owner
// and Tenant contexts share the same client-side `portfolioStore` in this app, so the code lookup
// and the resulting `tenancy.associated` flip are real, not mocked — the owner's Închirieri tiles
// show "Asociat"/"Neasociat" reflecting exactly what happens here. Every `associated` tenancy in
// the shared store shows up below as "mine" — there's no per-user tenancy_membership yet to scope
// this to a specific tenant account, single mock persona assumption same as the rest of the app.
// What's still missing: creating a real `tenancy_membership` on this user, and the bilateral
// fiscal data collection (Section 4.4).
//
// Same pinned-header pattern as the Owner CRUD screens (§4.3): the "+ Asociază chirie" trigger (or the
// open code form) stays fixed above a hairline divider, while "Chiriile mele" scrolls underneath it.
export function TenantTenanciesScreen() {
  const units = usePortfolioStore((state) => state.units);
  const properties = usePortfolioStore((state) => state.properties);
  const tenancies = usePortfolioStore((state) => state.tenancies);
  const associateTenancyByCode = usePortfolioStore((state) => state.associateTenancyByCode);

  const [formOpen, setFormOpen] = useState(false);
  const [associationCode, setAssociationCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const codeValid = associationCode.trim().length > 0;

  const resetForm = () => {
    setFormOpen(false);
    setAssociationCode("");
    setError(null);
  };

  const handleAssociate = () => {
    setError(null);
    // TODO(backend): no API exists yet — this is where the call goes once it does: resolve
    // `associationCode` to a `tenancy`, create a `tenancy_membership` on this user, then collect
    // the bilateral fiscal data (Section 4.4 — entity type, CUI/CNP) before the link finalizes.
    // For now `associateTenancyByCode` only flips local state on the shared portfolioStore.
    const result = associateTenancyByCode(associationCode);
    if (result === "not_found") {
      setError("Codul nu corespunde niciunei chirii.");
      return;
    }
    if (result === "already_associated") {
      setError("Acest cod a fost deja folosit.");
      return;
    }
    resetForm();
  };

  const myTenancies: TenancyEntry[] = tenancies
    .filter((tenancy) => tenancy.associated)
    .map((tenancy) => {
      const unit = units.find((u) => u.id === tenancy.unitId);
      const property = unit ? properties.find((p) => p.id === unit.propertyId) : undefined;
      return { tenancy, unit, property };
    });
  const propertiesWithTenancies = properties.filter((property) =>
    myTenancies.some((entry) => entry.property?.id === property.id),
  );
  const orphanTenancies = myTenancies.filter((entry) => !entry.property);

  const renderTenancyTile = (entry: TenancyEntry, index: number) => (
    <View
      key={entry.tenancy.id}
      style={[localStyles.tenancyListRow, index > 0 && localStyles.tenancyListRowDivider]}
    >
      <Text style={localStyles.optionText}>{entry.unit ? entry.unit.label : "Unitate ștearsă"}</Text>
      {entry.unit ? (
        <Text style={localStyles.unitTypeCaption}>{unitTypeLabel(entry.unit.type)}</Text>
      ) : null}
      <Text style={localStyles.entityCaption}>
        Cost chirie (lunar): {entry.tenancy.rentAmount} {entry.tenancy.rentCurrency} · din{" "}
        {entry.tenancy.startDate}
      </Text>
      {entry.unit
        ? entry.unit.utilities
            .filter((utility) => utility.enabled)
            .map((utility) => (
              <Text key={utility.type} style={localStyles.utilityCaption}>
                {utilityTypeLabel(utility.type)}: {utility.price.toFixed(2).replace(".", ",")}{" "}
                {utilityUnitLabel(utility.type)}
              </Text>
            ))
        : null}
    </View>
  );

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
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Text style={styles.caption}>
                Proprietarul generează acest cod când creează tenancy-ul pentru unitatea ta.
              </Text>

              <View style={localStyles.row}>
                <TouchableOpacity onPress={handleAssociate} disabled={!codeValid}>
                  <Text style={!codeValid ? localStyles.actionMuted : localStyles.action}>Asociază</Text>
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

      {myTenancies.length === 0 ? (
        <Text style={styles.hint}>Nu ești asociat cu nicio chirie încă.</Text>
      ) : (
        <>
          {propertiesWithTenancies.map((property) => (
            <View key={property.id} style={localStyles.propertyGroup}>
              <Text style={localStyles.propertyAddress}>{formatPropertyStreetLine(property)}</Text>
              <Text style={localStyles.propertyLocality}>{formatPropertyLocalityLine(property)}</Text>
              <View style={localStyles.tenancyList}>
                {myTenancies
                  .filter((entry) => entry.property?.id === property.id)
                  .map((entry, index) => renderTenancyTile(entry, index))}
              </View>
            </View>
          ))}
          {orphanTenancies.length > 0 ? (
            <View style={localStyles.propertyGroup}>
              <View style={localStyles.tenancyList}>
                {orphanTenancies.map((entry, index) => renderTenancyTile(entry, index))}
              </View>
            </View>
          ) : null}
        </>
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
  optionText: { fontSize: 15, fontWeight: "600" },
  unitTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  entityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  utilityCaption: { fontSize: 11, color: "#8e8e93", marginTop: 1 },
});
