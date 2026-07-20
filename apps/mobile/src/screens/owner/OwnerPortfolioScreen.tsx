import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { formatPropertyAddress, usePortfolioStore } from "../../context/portfolioStore";
import type { PropertyAddress, UnitType } from "../../context/portfolioStore";

type UnitCategory = "RESIDENTIAL" | "COMMERCIAL";

const UNIT_CATEGORIES: { value: UnitCategory; label: string }[] = [
  { value: "RESIDENTIAL", label: "Locativ" },
  { value: "COMMERCIAL", label: "Comercial" },
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

const ALL_UNIT_TYPES = Object.values(UNIT_TYPES_BY_CATEGORY).flat();

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
// a building (structured address, active/inactive, delete) — no type, no legal entity: both belong
// on `unit`s instead, since one building can hold units of different types *and* different legal
// entities. Tenancies (§4.4, OwnerTenanciesScreen) picks a unit from an active property here rather
// than creating one inline.
export function OwnerPortfolioScreen() {
  const legalEntities = usePortfolioStore((state) => state.legalEntities);
  const properties = usePortfolioStore((state) => state.properties);
  const units = usePortfolioStore((state) => state.units);
  const addProperty = usePortfolioStore((state) => state.addProperty);
  const updateProperty = usePortfolioStore((state) => state.updateProperty);
  const deleteProperty = usePortfolioStore((state) => state.deleteProperty);
  const setPropertyActive = usePortfolioStore((state) => state.setPropertyActive);
  const addUnit = usePortfolioStore((state) => state.addUnit);
  const updateUnit = usePortfolioStore((state) => state.updateUnit);
  const deleteUnit = usePortfolioStore((state) => state.deleteUnit);

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

  const unitValid = newUnitType !== null && newUnitLegalEntityId !== null && newUnitLabel.trim().length > 0;

  const resetUnitForm = () => {
    setUnitFormPropertyId(null);
    setEditingUnitId(null);
    setNewUnitCategory(null);
    setNewUnitType(null);
    setNewUnitLegalEntityId(null);
    setNewUnitLabel("");
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
  };

  const handleSubmitUnit = () => {
    if (!unitValid || !newUnitType || !newUnitLegalEntityId || !unitFormPropertyId) return;
    if (editingUnitId) {
      Alert.alert("Confirmi modificările?", `Se salvează modificările pentru ${newUnitLabel.trim()}.`, [
        { text: "Anulează", style: "cancel" },
        {
          text: "Confirmă",
          onPress: () => {
            updateUnit(editingUnitId, newUnitLegalEntityId, newUnitLabel.trim(), newUnitType);
            resetUnitForm();
          },
        },
      ]);
      return;
    }
    addUnit(unitFormPropertyId, newUnitLegalEntityId, newUnitLabel.trim(), newUnitType);
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
    <FormScreen contentContainerStyle={[styles.container, styles.containerCompactTop]} showBrand={false} longForm>
      {propertyFormOpen ? (
        <View style={localStyles.card}>
          <Text style={styles.sectionLabel}>Adresă</Text>
          <View style={localStyles.row}>
            <TextInput
              style={[styles.input, localStyles.addressNumber]}
              placeholder="Număr"
              value={newAddress.streetNumber}
              onChangeText={(value) => setNewAddress({ ...newAddress, streetNumber: value })}
            />
            <TextInput
              style={[styles.input, localStyles.addressStreet]}
              placeholder="Stradă"
              value={newAddress.street}
              onChangeText={(value) => setNewAddress({ ...newAddress, street: value })}
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
            <TouchableOpacity
              style={[styles.button, localStyles.flexButton, !addressValid && styles.buttonDisabled]}
              onPress={handleSubmitProperty}
              disabled={!addressValid}
            >
              <Text style={styles.buttonText}>
                {editingPropertyId ? "Salvează proprietate" : "Adaugă proprietate"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={localStyles.cancelButton} onPress={resetPropertyForm}>
              <Text style={localStyles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.sectionTrigger} onPress={openAddProperty}>
          <Text style={styles.sectionTriggerText}>+ Adaugă proprietate</Text>
        </TouchableOpacity>
      )}

      {properties.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio proprietate.</Text>
      ) : (
        properties.map((property) => (
          <View key={property.id} style={[localStyles.card, !property.active && localStyles.cardInactive]}>
            <Text style={localStyles.propertyAddress}>
              {formatPropertyAddress(property)}
              {!property.active ? " (dezactivată)" : ""}
            </Text>

            <View style={localStyles.row}>
              <TouchableOpacity onPress={() => openEditProperty(property.id)}>
                <Text style={localStyles.action}>Editează</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPropertyActive(property.id, !property.active)}>
                <Text style={localStyles.action}>{property.active ? "Dezactivează" : "Activează"}</Text>
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
                          editingUnitId === unit.id && localStyles.unitListRowEditing,
                        ]}
                        onPress={() => openEditUnit(unit.id)}
                      >
                        <View style={localStyles.unitInfo}>
                          <Text style={localStyles.unitLabel}>
                            {unit.label} · {ALL_UNIT_TYPES.find((type) => type.value === unit.type)?.label}
                          </Text>
                          <Text style={localStyles.unitEntityCaption}>{unitLegalEntity?.name ?? "—"}</Text>
                        </View>
                        <Text
                          style={unit.hasActiveTenancy ? localStyles.unitStatusRented : localStyles.unitStatusFree}
                        >
                          {unit.hasActiveTenancy ? "închiriată" : "liberă"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}

            {unitFormPropertyId === property.id ? (
              <View style={localStyles.unitForm}>
                <View style={styles.choiceRow}>
                  {UNIT_CATEGORIES.map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.choiceOption, newUnitCategory === value && styles.choiceOptionSelected]}
                      onPress={() => {
                        setNewUnitCategory(value);
                        setNewUnitType(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.choiceOptionText,
                          newUnitCategory === value && styles.choiceOptionTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

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

                <View style={localStyles.row}>
                  <TouchableOpacity onPress={handleSubmitUnit} disabled={!unitValid}>
                    <Text style={!unitValid ? localStyles.actionMuted : localStyles.action}>
                      {editingUnitId ? "Salvează" : "Adaugă"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={resetUnitForm}>
                    <Text style={localStyles.actionMuted}>Anulează</Text>
                  </TouchableOpacity>
                  {editingUnitId ? (
                    <TouchableOpacity
                      onPress={() => {
                        const unit = units.find((u) => u.id === editingUnitId);
                        if (unit) handleDeleteUnit(unit.id, unit.label, unit.hasActiveTenancy);
                      }}
                    >
                      <Text style={localStyles.actionDestructive}>Șterge</Text>
                    </TouchableOpacity>
                  ) : null}
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
                  <Text style={styles.hint}>Adaugă mai întâi o entitate legală mai sus.</Text>
                ) : null}
              </>
            )}
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
    marginTop: 8,
    backgroundColor: "#fff",
  },
  cardInactive: { opacity: 0.5 },
  propertyAddress: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", gap: 16, alignItems: "center" },
  flexButton: { flex: 1, marginTop: 0 },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 4 },
  cancelButtonText: { color: "#8e8e93", fontWeight: "600" },
  action: { color: "#1a73e8", fontWeight: "600" },
  actionMuted: { color: "#8e8e93" },
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
  unitListRowEditing: { backgroundColor: "#eaf1fd" },
  unitInfo: { flex: 1 },
  unitForm: { gap: 8, paddingLeft: 12, marginTop: 4 },
  unitInput: { flex: 1 },
  unitLabel: { fontSize: 15, fontWeight: "600" },
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
});
