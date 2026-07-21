import { useState } from "react";
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { Toggle } from "../../components/Toggle";
import {
  defaultUnitUtilities,
  formatPropertyAddress,
  formatPropertyLocalityLine,
  formatPropertyStreetLine,
  unitTypeLabel,
  usePortfolioStore,
  utilityTypeLabel,
  utilityUnitLabel,
} from "../../context/portfolioStore";
import type { PropertyAddress, UnitType, UnitUtility, UtilityType } from "../../context/portfolioStore";

// Digits and at most one decimal comma (Romanian convention — "0,00", matching the placeholder), up
// to 2 decimal places — same cap for every utility, metered (water/gas/electricity, priced per
// m³/kWh) or flat monthly sum alike. Validated as the user types rather than after the fact, so an
// invalid keystroke (a letter, a second ",", a third decimal digit) is just silently refused instead
// of committed-then-flagged.
const UTILITY_PRICE_PATTERN = /^\d*(,\d{0,2})?$/;

type UnitCategory = "RESIDENTIAL" | "COMMERCIAL";

const UNIT_CATEGORIES: [{ value: UnitCategory; label: string }, { value: UnitCategory; label: string }] = [
  { value: "RESIDENTIAL", label: "Locativă" },
  { value: "COMMERCIAL", label: "Comercială" },
];

const UNIT_TYPES_BY_CATEGORY: Record<UnitCategory, { value: UnitType; label: string }[]> = {
  RESIDENTIAL: [
    { value: "APARTMENT", label: "Apartament" },
    { value: "HOUSE", label: "Casă" },
  ],
  COMMERCIAL: [
    { value: "RETAIL", label: "Spațiu comercial" },
    { value: "WAREHOUSE", label: "Hală / Depozit" },
    { value: "OFFICE", label: "Birou" },
  ],
};

function categoryForUnitType(type: UnitType): UnitCategory {
  return UNIT_TYPES_BY_CATEGORY.RESIDENTIAL.some((option) => option.value === type)
    ? "RESIDENTIAL"
    : "COMMERCIAL";
}

const emptyAddress: PropertyAddress = {
  streetNumber: "",
  street: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  county: "",
};


// Section 4.3, minimal slice. "Entități legale" is a visually separate module at the top (this
// screen's focus is Portofoliu, i.e. properties/units below it) — add/edit a fiscal identity
// ("firmă"), business forms collect CUI/VAT/invoice series right away (no purpose without a CUI),
// Persoană Fizică just gets a name, CNP stays deferred to first tenancy (§4.4). A `property` is just
// a building (structured address, delete) — no type, no legal entity, no active/inactive toggle:
// those live on `unit`s instead, since one building can hold units of different types *and*
// different legal entities, and "active" (still rentable vs. taken off the market) only makes sense
// per-unit, not for the whole building (moved down from property-level after this was originally
// tried there — a building-wide toggle didn't make sense once landlords could have some units still
// rentable and others not). Tenancies (§4.4, OwnerTenanciesScreen) picks an active unit here rather
// than creating one inline.
export function OwnerPortfolioScreen() {
  const legalEntities = usePortfolioStore((state) => state.legalEntities);
  const properties = usePortfolioStore((state) => state.properties);
  const units = usePortfolioStore((state) => state.units);
  const addProperty = usePortfolioStore((state) => state.addProperty);
  const updateProperty = usePortfolioStore((state) => state.updateProperty);
  const deleteProperty = usePortfolioStore((state) => state.deleteProperty);
  const addUnit = usePortfolioStore((state) => state.addUnit);
  const updateUnit = usePortfolioStore((state) => state.updateUnit);
  const deleteUnit = usePortfolioStore((state) => state.deleteUnit);
  const setUnitActive = usePortfolioStore((state) => state.setUnitActive);

  // ---- Property form (shared by add + edit) ----
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState<PropertyAddress>(emptyAddress);

  const addressValid =
    newAddress.streetNumber.trim().length > 0 &&
    newAddress.street.trim().length > 0 &&
    newAddress.postalCode.trim().length > 0 &&
    newAddress.city.trim().length > 0 &&
    newAddress.county.trim().length > 0;

  const resetPropertyForm = () => {
    setPropertyFormOpen(false);
    setEditingPropertyId(null);
    setNewAddress(emptyAddress);
  };

  const openAddProperty = () => {
    resetPropertyForm();
    setPropertyFormOpen(true);
  };

  const openEditProperty = (id: string) => {
    const property = properties.find((p) => p.id === id);
    if (!property) return;
    setEditingPropertyId(id);
    setNewAddress({
      streetNumber: property.streetNumber,
      street: property.street,
      addressLine2: property.addressLine2 ?? "",
      postalCode: property.postalCode,
      city: property.city,
      county: property.county,
    });
    setPropertyFormOpen(true);
  };

  const handleSubmitProperty = () => {
    if (!addressValid) return;
    const address = { ...newAddress, addressLine2: newAddress.addressLine2?.trim() || undefined };
    if (editingPropertyId) {
      Alert.alert("Confirmi modificările?", `Se salvează modificările pentru ${formatPropertyAddress(address)}.`, [
        { text: "Anulează", style: "cancel" },
        {
          text: "Confirmă",
          onPress: () => {
            updateProperty(editingPropertyId, address);
            resetPropertyForm();
          },
        },
      ]);
      return;
    }
    addProperty(address);
    resetPropertyForm();
  };

  const handleDeleteProperty = (id: string, label: string) => {
    Alert.alert("Ștergi proprietatea?", `${label} și unitățile ei vor fi șterse definitiv.`, [
      { text: "Anulează", style: "cancel" },
      { text: "Șterge", style: "destructive", onPress: () => deleteProperty(id) },
    ]);
  };

  // ---- Unit form (shared by add + edit, scoped to one property at a time) ----
  const [unitFormPropertyId, setUnitFormPropertyId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [newUnitCategory, setNewUnitCategory] = useState<UnitCategory | null>(null);
  const [newUnitType, setNewUnitType] = useState<UnitType | null>(null);
  const [newUnitLegalEntityId, setNewUnitLegalEntityId] = useState<string | null>(null);
  const [newUnitLabel, setNewUnitLabel] = useState("");
  const [newUnitUtilities, setNewUnitUtilities] = useState<UnitUtility[]>(defaultUnitUtilities());
  // Separate from `newUnitUtilities`' own numeric `price` — binding the TextInput straight to
  // `String(price)` re-derives the displayed text from the number on every keystroke, which drops a
  // trailing "." the moment it's typed (Number("0.") === 0, so "0." immediately renders back as
  // "0"), making a value like "0.850" impossible to type from scratch. This holds the exact text the
  // user typed; `newUnitUtilities`' price is kept in sync alongside it for submitting.
  const [utilityPriceText, setUtilityPriceText] = useState<Partial<Record<UtilityType, string>>>({});

  const unitValid = newUnitType !== null && newUnitLegalEntityId !== null && newUnitLabel.trim().length > 0;

  const resetUnitForm = () => {
    setUnitFormPropertyId(null);
    setEditingUnitId(null);
    setNewUnitCategory(null);
    setNewUnitType(null);
    setNewUnitLegalEntityId(null);
    setNewUnitLabel("");
    setNewUnitUtilities(defaultUnitUtilities());
    setUtilityPriceText({});
  };

  const openAddUnit = (propertyId: string) => {
    if (legalEntities.length === 0) return;
    resetUnitForm();
    setUnitFormPropertyId(propertyId);
  };

  const openEditUnit = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;
    setUnitFormPropertyId(unit.propertyId);
    setEditingUnitId(unitId);
    setNewUnitCategory(categoryForUnitType(unit.type));
    setNewUnitType(unit.type);
    setNewUnitLegalEntityId(unit.legalEntityId);
    setNewUnitLabel(unit.label);
    setNewUnitUtilities(unit.utilities);
    setUtilityPriceText(
      Object.fromEntries(
        unit.utilities.map((utility) => [
          utility.type,
          utility.price ? String(utility.price).replace(".", ",") : "",
        ]),
      ),
    );
  };

  const updateNewUnitUtility = (type: UnitUtility["type"], patch: Partial<UnitUtility>) => {
    setNewUnitUtilities((current) => current.map((u) => (u.type === type ? { ...u, ...patch } : u)));
  };

  const handleUtilityPriceChange = (type: UtilityType, text: string) => {
    if (!UTILITY_PRICE_PATTERN.test(text)) return;
    setUtilityPriceText((current) => ({ ...current, [type]: text }));
    updateNewUnitUtility(type, { price: Number(text.replace(",", ".")) || 0 });
  };

  const handleSubmitUnit = () => {
    if (!unitValid || !newUnitType || !newUnitLegalEntityId || !unitFormPropertyId) return;
    if (editingUnitId) {
      Alert.alert("Confirmi modificările?", `Se salvează modificările pentru ${newUnitLabel.trim()}.`, [
        { text: "Anulează", style: "cancel" },
        {
          text: "Confirmă",
          onPress: () => {
            updateUnit(editingUnitId, newUnitLegalEntityId, newUnitLabel.trim(), newUnitType, newUnitUtilities);
            resetUnitForm();
          },
        },
      ]);
      return;
    }
    addUnit(unitFormPropertyId, newUnitLegalEntityId, newUnitLabel.trim(), newUnitType, newUnitUtilities);
    resetUnitForm();
  };

  const handleDeleteUnit = (id: string, label: string, hasActiveTenancy: boolean) => {
    Alert.alert(
      "Ștergi unitatea?",
      hasActiveTenancy
        ? `${label} este momentan închiriată. Va fi ștearsă definitiv.`
        : `${label} va fi ștearsă definitiv.`,
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: () => {
            deleteUnit(id);
            resetUnitForm();
          },
        },
      ],
    );
  };

  return (
    <FormScreen
      contentContainerStyle={[styles.container, styles.containerHeaderTop]}
      showBrand={false}
      longForm
      header={
        <>
          {propertyFormOpen && editingPropertyId === null ? (
            <View style={localStyles.card}>
              <Text style={styles.sectionLabel}>Adresă</Text>
              <View style={localStyles.row}>
                <TextInput
                  style={[styles.input, localStyles.addressStreet]}
                  placeholder="Stradă"
                  value={newAddress.street}
                  onChangeText={(value) => setNewAddress({ ...newAddress, street: value })}
                />
                <TextInput
                  style={[styles.input, localStyles.addressNumber]}
                  placeholder="Număr"
                  value={newAddress.streetNumber}
                  onChangeText={(value) => setNewAddress({ ...newAddress, streetNumber: value })}
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Linie opțională (bloc, scară, etaj, ap.)"
                value={newAddress.addressLine2}
                onChangeText={(value) => setNewAddress({ ...newAddress, addressLine2: value })}
              />
              <TextInput
                style={styles.input}
                placeholder="Cod poștal"
                keyboardType="numbers-and-punctuation"
                value={newAddress.postalCode}
                onChangeText={(value) => setNewAddress({ ...newAddress, postalCode: value })}
              />
              <TextInput
                style={styles.input}
                placeholder="Oraș"
                value={newAddress.city}
                onChangeText={(value) => setNewAddress({ ...newAddress, city: value })}
              />
              <TextInput
                style={styles.input}
                placeholder="Județ"
                value={newAddress.county}
                onChangeText={(value) => setNewAddress({ ...newAddress, county: value })}
              />

              <View style={localStyles.row}>
                <TouchableOpacity onPress={handleSubmitProperty} disabled={!addressValid}>
                  <Text style={!addressValid ? localStyles.actionMuted : localStyles.action}>
                    Adaugă proprietate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetPropertyForm}>
                  <Text style={localStyles.actionMuted}>Anulează</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.sectionTrigger} onPress={openAddProperty}>
              <Text style={styles.sectionTriggerText}>+ Adaugă proprietate</Text>
            </TouchableOpacity>
          )}
          <View style={localStyles.sectionDivider} />
        </>
      }
    >
      <Text style={styles.sectionLabel}>Proprietăți existente</Text>

      {properties.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio proprietate.</Text>
      ) : (
        properties.map((property) =>
          editingPropertyId === property.id ? (
            <View key={property.id} style={[localStyles.card, localStyles.cardEditing]}>
              <Text style={styles.sectionLabel}>Adresă</Text>
              <View style={localStyles.row}>
                <TextInput
                  style={[styles.input, localStyles.addressStreet]}
                  placeholder="Stradă"
                  value={newAddress.street}
                  onChangeText={(value) => setNewAddress({ ...newAddress, street: value })}
                />
                <TextInput
                  style={[styles.input, localStyles.addressNumber]}
                  placeholder="Număr"
                  value={newAddress.streetNumber}
                  onChangeText={(value) => setNewAddress({ ...newAddress, streetNumber: value })}
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Linie opțională (bloc, scară, etaj, ap.)"
                value={newAddress.addressLine2}
                onChangeText={(value) => setNewAddress({ ...newAddress, addressLine2: value })}
              />
              <TextInput
                style={styles.input}
                placeholder="Cod poștal"
                keyboardType="numbers-and-punctuation"
                value={newAddress.postalCode}
                onChangeText={(value) => setNewAddress({ ...newAddress, postalCode: value })}
              />
              <TextInput
                style={styles.input}
                placeholder="Oraș"
                value={newAddress.city}
                onChangeText={(value) => setNewAddress({ ...newAddress, city: value })}
              />
              <TextInput
                style={styles.input}
                placeholder="Județ"
                value={newAddress.county}
                onChangeText={(value) => setNewAddress({ ...newAddress, county: value })}
              />

              <View style={localStyles.row}>
                <TouchableOpacity onPress={handleSubmitProperty} disabled={!addressValid}>
                  <Text style={!addressValid ? localStyles.actionMuted : localStyles.action}>
                    Salvează proprietate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetPropertyForm}>
                  <Text style={localStyles.actionMuted}>Anulează</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <View key={property.id} style={localStyles.card}>
            <Text style={localStyles.propertyAddress}>{formatPropertyStreetLine(property)}</Text>
            <Text style={localStyles.propertyLocality}>{formatPropertyLocalityLine(property)}</Text>

            <View style={localStyles.row}>
              <TouchableOpacity onPress={() => openEditProperty(property.id)}>
                <Text style={localStyles.action}>Editează</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteProperty(property.id, formatPropertyAddress(property))}>
                <Text style={localStyles.actionDestructive}>Șterge</Text>
              </TouchableOpacity>
            </View>

            {(() => {
              const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
              if (propertyUnits.length === 0) return null;
              return (
                <View style={localStyles.unitList}>
                  {propertyUnits.map((unit, index) => {
                    const unitLegalEntity = legalEntities.find((e) => e.id === unit.legalEntityId);
                    return (
                      <TouchableOpacity
                        key={unit.id}
                        style={[
                          localStyles.unitListRow,
                          index > 0 && localStyles.unitListRowDivider,
                          !unit.active && localStyles.unitListRowInactive,
                          editingUnitId === unit.id && localStyles.unitListRowEditing,
                        ]}
                        onPress={() => openEditUnit(unit.id)}
                      >
                        <View style={localStyles.unitInfo}>
                          <Text style={localStyles.unitLabel}>
                            {unit.label}
                            {!unit.active ? " (dezactivată)" : ""}
                          </Text>
                          <Text style={localStyles.unitTypeCaption}>{unitTypeLabel(unit.type)}</Text>
                          <Text style={localStyles.unitEntityCaption}>{unitLegalEntity?.name ?? "—"}</Text>
                        </View>
                        <Text
                          style={unit.hasActiveTenancy ? localStyles.unitStatusRented : localStyles.unitStatusFree}
                        >
                          {unit.hasActiveTenancy ? "Închiriată" : "Liberă"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}

            {unitFormPropertyId === property.id ? (
              <View style={localStyles.unitForm}>
                <Toggle
                  label="Tip unitate"
                  options={UNIT_CATEGORIES}
                  value={newUnitCategory}
                  onChange={(value) => {
                    setNewUnitCategory(value);
                    setNewUnitType(null);
                  }}
                />

                {newUnitCategory ? (
                  <View style={localStyles.optionList}>
                    {UNIT_TYPES_BY_CATEGORY[newUnitCategory].map(({ value, label }, index) => (
                      <TouchableOpacity
                        key={value}
                        style={[
                          localStyles.option,
                          index > 0 && localStyles.optionDivider,
                          newUnitType === value && localStyles.optionSelected,
                        ]}
                        onPress={() => setNewUnitType(value)}
                      >
                        <Text style={localStyles.optionText}>{label}</Text>
                        {newUnitType === value ? <Text style={localStyles.optionCheck}>✓</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <TextInput
                  style={styles.input}
                  placeholder="Etichetă unitate (ex. Ap. 3)"
                  value={newUnitLabel}
                  onChangeText={setNewUnitLabel}
                />

                <Text style={styles.sectionLabel}>Selectează entitatea legală</Text>
                <View style={localStyles.optionList}>
                  {legalEntities.map((entity, index) => (
                    <TouchableOpacity
                      key={entity.id}
                      style={[
                        localStyles.option,
                        index > 0 && localStyles.optionDivider,
                        newUnitLegalEntityId === entity.id && localStyles.optionSelected,
                      ]}
                      onPress={() => setNewUnitLegalEntityId(entity.id)}
                    >
                      <Text style={localStyles.optionText}>{entity.name}</Text>
                      {newUnitLegalEntityId === entity.id ? (
                        <Text style={localStyles.optionCheck}>✓</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Utilități</Text>
                <View style={localStyles.optionList}>
                  {newUnitUtilities.map((utility, index) => (
                    <View
                      key={utility.type}
                      style={[localStyles.utilityRow, index > 0 && localStyles.optionDivider]}
                    >
                      <View style={localStyles.utilityRowHeader}>
                        <Text style={localStyles.optionText}>{utilityTypeLabel(utility.type)}</Text>
                        <View style={localStyles.utilityControls}>
                          {utility.enabled ? (
                            <>
                              <TextInput
                                style={[styles.input, localStyles.utilityPriceInput]}
                                placeholder="0,00"
                                keyboardType="decimal-pad"
                                value={utilityPriceText[utility.type] ?? ""}
                                onChangeText={(value) => handleUtilityPriceChange(utility.type, value)}
                              />
                              <Text style={localStyles.utilityPriceUnit}>{utilityUnitLabel(utility.type)}</Text>
                            </>
                          ) : null}
                          <Switch
                            value={utility.enabled}
                            onValueChange={(enabled) => updateNewUnitUtility(utility.type, { enabled })}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={localStyles.row}>
                  <TouchableOpacity onPress={handleSubmitUnit} disabled={!unitValid}>
                    <Text style={!unitValid ? localStyles.actionMuted : localStyles.action}>
                      {editingUnitId ? "Salvează" : "Adaugă"}
                    </Text>
                  </TouchableOpacity>
                  {editingUnitId ? (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          const unit = units.find((u) => u.id === editingUnitId);
                          if (unit) setUnitActive(unit.id, !unit.active);
                        }}
                      >
                        <Text style={localStyles.action}>
                          {units.find((u) => u.id === editingUnitId)?.active ? "Dezactivează" : "Activează"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const unit = units.find((u) => u.id === editingUnitId);
                          if (unit) handleDeleteUnit(unit.id, unit.label, unit.hasActiveTenancy);
                        }}
                      >
                        <Text style={localStyles.actionDestructive}>Șterge</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  <TouchableOpacity onPress={resetUnitForm}>
                    <Text style={localStyles.actionMuted}>Anulează</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => openAddUnit(property.id)}
                  disabled={legalEntities.length === 0}
                >
                  <Text style={legalEntities.length === 0 ? localStyles.addLinkDisabled : localStyles.addUnitLink}>
                    + Adaugă unitate
                  </Text>
                </TouchableOpacity>
                {legalEntities.length === 0 ? (
                  <Text style={styles.hint}>Adaugă mai întâi o entitate legală în panoul de Setări.</Text>
                ) : null}
              </>
            )}
          </View>
          ),
        )
      )}
    </FormScreen>
  );
}

const localStyles = StyleSheet.create({
  // Marks the boundary between "add a property" (trigger/form) and the existing properties below —
  // same as Închirieri's divider between the add-tenancy block and "Chirii existente".
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#ccc", marginTop: 16 },
  card: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 8,
    backgroundColor: "#fff",
  },
  cardEditing: { borderColor: "#1a73e8" },
  propertyAddress: { fontSize: 16, fontWeight: "600" },
  // Pulled closer than the card's own `gap: 8` would give by default, so it reads as a sub-line of
  // the address above rather than a separate item.
  propertyLocality: { fontSize: 13, color: "#8e8e93", marginTop: -4 },
  row: { flexDirection: "row", gap: 16, alignItems: "center" },
  action: { color: "#1a73e8", fontWeight: "600" },
  // Slightly bolder than plain text so Anulează reads a bit more prominently, still neutral grey.
  actionMuted: { color: "#8e8e93", fontWeight: "600" },
  actionDestructive: { color: "#d32f2f", fontWeight: "600" },
  addLinkDisabled: { color: "#c7c7cc" },
  addressNumber: { flex: 1 },
  addressStreet: { flex: 3 },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingLeft: 12,
  },
  unitList: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  unitListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 12,
  },
  unitListRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  unitListRowInactive: { opacity: 0.5 },
  unitListRowEditing: { backgroundColor: "#eaf1fd" },
  unitInfo: { flex: 1 },
  unitForm: { gap: 8, paddingLeft: 12, marginTop: 4 },
  unitInput: { flex: 1 },
  unitLabel: { fontSize: 15, fontWeight: "600" },
  unitTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  unitEntityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  unitStatusFree: { color: "#1a9e5c", fontSize: 12, fontWeight: "600" },
  unitStatusRented: { color: "#8e8e93", fontSize: 12, fontWeight: "600" },
  addUnitLink: { color: "#1a73e8", paddingLeft: 12 },
  optionList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#ccc" },
  optionSelected: { backgroundColor: "#eaf1fd" },
  optionText: { flex: 1 },
  optionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
  utilityRow: { padding: 12 },
  utilityRowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // Price field, unit of measure, and the toggle all sit together on the right, in that order —
  // the unit of measure lives next to the field itself (not inside its placeholder, which
  // disappears the moment you start typing) and the toggle continues right after it.
  utilityControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Wide enough for ~5 digits ("999,99") — was flex:1 (full row width), unnecessarily wide for a
  // short number.
  utilityPriceInput: {
    width: 70,
    marginTop: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: "right",
  },
  utilityPriceUnit: { color: "#8e8e93", fontWeight: "600" },
});
