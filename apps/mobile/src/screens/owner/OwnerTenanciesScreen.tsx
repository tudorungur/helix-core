import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { formatPropertyAddress, usePortfolioStore } from "../../context/portfolioStore";
import type { RentCurrency, Unit } from "../../context/portfolioStore";
import type { OwnerTabsParamList } from "../../navigation/OwnerTabs";

type Props = BottomTabScreenProps<OwnerTabsParamList, "Tenancies">;

const CURRENCIES: { value: RentCurrency; label: string }[] = [
  { value: "EUR", label: "EUR" },
  { value: "RON", label: "RON" },
];

// Section 4.4, minimal slice — creates a tenancy on a unit that already exists in the Portfolio
// (§4.3, OwnerPortfolioScreen), picked from `usePortfolioStore`'s units where
// `hasActiveTenancy: false`. Does NOT create a property/unit inline anymore (it used to — that
// conflated §4.3 and §4.4 into one form); an empty portfolio sends the owner there instead. Created
// tenancies persist as their own tiles (contract data + the association_code, always accessible —
// it used to only flash once on a "result" screen and then be gone for good) via
// `usePortfolioStore`'s `tenancies`/`addTenancy`. Both the unit picker (when adding a new tenancy)
// and the list of already-created tenancies group by property — same visual pattern as Portofoliu's
// property→units nesting — so units/tenancies on the same building read as belonging together. Still
// no backend — `addTenancy` is entirely client-side (TODO(backend) below), and nothing survives a
// fresh app launch.
export function OwnerTenanciesScreen({ navigation }: Props) {
  const units = usePortfolioStore((state) => state.units);
  const properties = usePortfolioStore((state) => state.properties);
  const tenancies = usePortfolioStore((state) => state.tenancies);
  const addTenancy = usePortfolioStore((state) => state.addTenancy);

  // Only units on an active property are eligible — a deactivated property (Section 4.3) drops out
  // of new-tenancy eligibility without needing its units individually excluded.
  const availableUnits = units.filter((unit) => {
    if (unit.hasActiveTenancy) return false;
    const property = properties.find((p) => p.id === unit.propertyId);
    return property?.active ?? false;
  });
  const propertiesWithAvailableUnits = properties.filter((property) =>
    availableUnits.some((unit) => unit.propertyId === property.id),
  );

  // Precomputed once per render rather than re-searched per tile — resolves each tenancy's unit +
  // property so the list below can group by property; tenancies whose unit was since deleted (no
  // backend integrity constraint in this mock) fall into `orphanTenancies` instead of a group.
  const tenanciesWithContext = tenancies.map((tenancy) => {
    const unit = units.find((u) => u.id === tenancy.unitId);
    const property = unit ? properties.find((p) => p.id === unit.propertyId) : undefined;
    return { tenancy, unit, property };
  });
  const propertiesWithTenancies = properties.filter((property) =>
    tenanciesWithContext.some((entry) => entry.property?.id === property.id),
  );
  const orphanTenancies = tenanciesWithContext.filter((entry) => !entry.property);

  const [formOpen, setFormOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [currency, setCurrency] = useState<RentCurrency | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFormOpen(false);
    setSelectedUnitId(null);
    setStartDate("");
    setRentAmount("");
    setCurrency(null);
  };

  const unitValid = selectedUnitId !== null;
  const startDateValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const rentAmountValid = rentAmount.trim().length > 0 && Number(rentAmount) > 0;
  const currencyValid = currency !== null;
  const formValid = unitValid && startDateValid && rentAmountValid && currencyValid;

  const handleCreateTenancy = () => {
    if (!selectedUnitId || !currency) return;
    setSubmitting(true);
    // TODO(backend): no API exists yet — this is where the call goes once it does: create
    // `tenancy(unit_id, start_date, rent_amount, rent_currency)` with a generated
    // `tenancies.association_code` (Section 4.4). For now `addTenancy` only updates local state.
    addTenancy(selectedUnitId, startDate, Number(rentAmount), currency);
    setSubmitting(false);
    resetForm();
  };

  const renderTenancyTile = (tenancy: (typeof tenancies)[number], unit: Unit | undefined) => (
    <View key={tenancy.id} style={localStyles.tenancyTile}>
      <Text style={localStyles.optionText}>{unit ? unit.label : "Unitate ștearsă"}</Text>
      <Text style={localStyles.entityCaption}>
        {tenancy.rentAmount} {tenancy.rentCurrency} · din {tenancy.startDate}
      </Text>
      <Text style={localStyles.tenancyCode}>Cod de asociere: {tenancy.associationCode}</Text>
      <Text style={styles.caption}>Trebuie trimis chiriașului pentru adăugarea unității.</Text>
    </View>
  );

  return (
    <FormScreen contentContainerStyle={[styles.container, styles.containerCompactTop]} showBrand={false} longForm>
      {tenancies.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio chirie creată.</Text>
      ) : (
        <>
          {propertiesWithTenancies.map((property) => (
            <View key={property.id} style={localStyles.propertyGroup}>
              <Text style={localStyles.propertyAddress}>{formatPropertyAddress(property)}</Text>
              {tenanciesWithContext
                .filter((entry) => entry.property?.id === property.id)
                .map((entry) => renderTenancyTile(entry.tenancy, entry.unit))}
            </View>
          ))}
          {orphanTenancies.map((entry) => renderTenancyTile(entry.tenancy, entry.unit))}
        </>
      )}

      {availableUnits.length === 0 ? (
        formOpen ? null : (
          <>
            <Text style={styles.hint}>
              Toate unitățile din portofoliu sunt deja închiriate, sau nu ai adăugat încă niciuna.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Portfolio")}>
              <Text style={styles.buttonText}>Mergi la Portofoliu</Text>
            </TouchableOpacity>
          </>
        )
      ) : formOpen ? (
        <View style={localStyles.card}>
          <Text style={styles.sectionLabel}>Unitate</Text>
          {propertiesWithAvailableUnits.map((property) => (
            <View key={property.id}>
              <Text style={localStyles.unitGroupLabel}>{formatPropertyAddress(property)}</Text>
              {availableUnits
                .filter((unit) => unit.propertyId === property.id)
                .map((unit) => (
                  <TouchableOpacity
                    key={unit.id}
                    style={[localStyles.tile, selectedUnitId === unit.id && localStyles.tileSelected]}
                    onPress={() => setSelectedUnitId(unit.id)}
                  >
                    <Text style={localStyles.unitOptionText}>{unit.label}</Text>
                    {selectedUnitId === unit.id ? <Text style={localStyles.unitOptionCheck}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
            </View>
          ))}

          <Text style={styles.sectionLabel}>Contract</Text>
          <TextInput
            style={styles.input}
            placeholder="Dată început (AAAA-LL-ZZ)"
            keyboardType="numbers-and-punctuation"
            value={startDate}
            onChangeText={setStartDate}
          />
          {startDate.length > 0 && !startDateValid ? (
            <Text style={styles.error}>Format așteptat: AAAA-LL-ZZ</Text>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Chirie"
            keyboardType="decimal-pad"
            value={rentAmount}
            onChangeText={setRentAmount}
          />

          <View style={styles.choiceRow}>
            {CURRENCIES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.choiceOption, currency === value && styles.choiceOptionSelected]}
                onPress={() => setCurrency(value)}
              >
                <Text style={[styles.choiceOptionText, currency === value && styles.choiceOptionTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={localStyles.row}>
            <TouchableOpacity
              style={[styles.button, localStyles.flexButton, (submitting || !formValid) && styles.buttonDisabled]}
              onPress={handleCreateTenancy}
              disabled={submitting || !formValid}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Creează chirie</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={localStyles.cancelButton} onPress={resetForm}>
              <Text style={localStyles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.sectionTrigger} onPress={() => setFormOpen(true)}>
          <Text style={styles.sectionTriggerText}>+ Adaugă chirie</Text>
        </TouchableOpacity>
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
    marginTop: 8,
    backgroundColor: "#fff",
  },
  // Same outer shape as Portofoliu's property card (border/radius/padding/background) — groups
  // every tenancy on that property's units underneath its address, same nesting pattern as
  // properties → units there.
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
  unitGroupLabel: {
    color: "#8e8e93",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  tenancyTile: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  tenancyCode: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  flexButton: { flex: 1, marginTop: 0 },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 4 },
  cancelButtonText: { color: "#8e8e93", fontWeight: "600" },
  // Same tile look as Portofoliu's property cards — a separate bordered box per option, not one
  // shared box with divided rows.
  tile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    backgroundColor: "#fff",
  },
  tileSelected: { borderColor: "#1a73e8", backgroundColor: "#eaf1fd" },
  unitOptionText: { flex: 1 },
  unitOptionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
  optionText: { fontSize: 16, fontWeight: "600" },
  entityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
});
