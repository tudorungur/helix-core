import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { Toggle } from "../../components/Toggle";
import {
  formatPropertyLocalityLine,
  formatPropertyStreetLine,
  unitTypeLabel,
  usePortfolioStore,
} from "../../context/portfolioStore";
import type { RentCurrency, Tenancy, Unit } from "../../context/portfolioStore";

const CURRENCIES: [{ value: RentCurrency; label: string }, { value: RentCurrency; label: string }] = [
  { value: "EUR", label: "EUR" },
  { value: "RON", label: "RON" },
];

// Same "Etichetă · Subtip" format as Portofoliu's unit tiles (Section 4.3).
function unitDisplayLabel(unit: Unit | undefined): string {
  return unit ? `${unit.label} · ${unitTypeLabel(unit.type)}` : "Unitate ștearsă";
}

// Section 4.4, minimal slice — creates a tenancy on a unit that already exists in the Portfolio
// (§4.3, OwnerPortfolioScreen), picked from `usePortfolioStore`'s units where
// `hasActiveTenancy: false`. Does NOT create a property/unit inline anymore (it used to — that
// conflated §4.3 and §4.4 into one form); an empty portfolio sends the owner there instead. Created
// tenancies persist as their own tiles (contract data + the association_code, always accessible —
// it used to only flash once on a "result" screen and then be gone for good) via
// `usePortfolioStore`'s `tenancies`/`addTenancy`. Both the unit picker (when adding a new tenancy)
// and the list of already-created tenancies group by property — same visual pattern as Portofoliu's
// property→units nesting — so units/tenancies on the same building read as belonging together. Every
// tenancy tile is tappable to edit its contract terms in place (same pattern as units in Portofoliu —
// no separate "Editează" button, the whole tile opens the form), with a "Copiază" button on the
// association code (expo-clipboard) so it doesn't have to be retyped by hand. `addTenancy`/
// `updateTenancy`/`deleteTenancy` call the real services/tenancies API (Section 4.4 phase 1) as of
// this session — the tenant-side "claim the code" step (phase 2) is still mocked, see
// `associateTenancyByCode` in portfolioStore.ts.
export function OwnerTenanciesScreen() {
  const legalEntities = usePortfolioStore((state) => state.legalEntities);
  const units = usePortfolioStore((state) => state.units);
  const properties = usePortfolioStore((state) => state.properties);
  const tenancies = usePortfolioStore((state) => state.tenancies);
  const addTenancy = usePortfolioStore((state) => state.addTenancy);
  const updateTenancy = usePortfolioStore((state) => state.updateTenancy);
  const deleteTenancy = usePortfolioStore((state) => state.deleteTenancy);
  const portfolioLoading = usePortfolioStore((state) => state.loading);
  const portfolioError = usePortfolioStore((state) => state.error);

  // Only active, not-yet-rented units are eligible (Section 4.3 — `active` lives on the unit, not
  // the property).
  const availableUnits = units.filter((unit) => unit.active && !unit.hasActiveTenancy);
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
  const startDateValid = /^\d{2}-\d{2}-\d{4}$/.test(startDate);
  const rentAmountValid = rentAmount.trim().length > 0 && Number(rentAmount) > 0;
  const currencyValid = currency !== null;
  const formValid = unitValid && startDateValid && rentAmountValid && currencyValid;

  const handleApiError = (error: unknown) => {
    Alert.alert("Eroare", error instanceof Error ? error.message : "A apărut o eroare neașteptată.");
  };

  const handleCreateTenancy = async () => {
    if (!selectedUnitId || !currency) return;
    setSubmitting(true);
    try {
      await addTenancy(selectedUnitId, startDate, Number(rentAmount), currency);
      resetForm();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Editing an existing tenancy's contract terms in place (not the unit — reassigning a
  // tenancy to a different unit isn't supported) ----
  const [editingTenancyId, setEditingTenancyId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editRentAmount, setEditRentAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState<RentCurrency | null>(null);

  const editStartDateValid = /^\d{2}-\d{2}-\d{4}$/.test(editStartDate);
  const editRentAmountValid = editRentAmount.trim().length > 0 && Number(editRentAmount) > 0;
  const editValid = editStartDateValid && editRentAmountValid && editCurrency !== null;

  const openEditTenancy = (tenancy: Tenancy) => {
    setEditingTenancyId(tenancy.id);
    setEditStartDate(tenancy.startDate);
    setEditRentAmount(String(tenancy.rentAmount));
    setEditCurrency(tenancy.rentCurrency);
  };

  const resetTenancyEdit = () => {
    setEditingTenancyId(null);
    setEditStartDate("");
    setEditRentAmount("");
    setEditCurrency(null);
  };

  const submitEditTenancy = () => {
    if (!editingTenancyId || !editValid || !editCurrency) return;
    Alert.alert("Confirmi modificările?", "Se salvează modificările pentru această chirie.", [
      { text: "Anulează", style: "cancel" },
      {
        text: "Confirmă",
        onPress: async () => {
          try {
            await updateTenancy(editingTenancyId, editStartDate, Number(editRentAmount), editCurrency);
            resetTenancyEdit();
          } catch (error) {
            handleApiError(error);
          }
        },
      },
    ]);
  };

  const handleDeleteTenancy = (tenancy: Tenancy, unit: Unit | undefined) => {
    Alert.alert(
      "Ștergi chiria?",
      `Chiria pentru ${unit ? unit.label : "unitatea ștearsă"} va fi ștearsă definitiv. Unitatea va deveni disponibilă pentru o chirie nouă.`,
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTenancy(tenancy.id);
              resetTenancyEdit();
            } catch (error) {
              handleApiError(error);
            }
          },
        },
      ],
    );
  };

  // ---- Copy association code ----
  const [copiedTenancyId, setCopiedTenancyId] = useState<string | null>(null);

  const handleCopyCode = async (tenancyId: string, code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedTenancyId(tenancyId);
    setTimeout(() => setCopiedTenancyId((current) => (current === tenancyId ? null : current)), 1500);
  };

  // Read-only summary row only — highlighted when it's the one being edited, but the edit form
  // itself never nests inside this row (that used to make the whole row, form included, read as
  // one big blue block). Same split as Portofoliu's unit rows: the row here is the trigger +
  // highlight, `renderTenancyEditForm` below renders the actual form once per property group.
  const renderTenancyTile = (tenancy: Tenancy, unit: Unit | undefined, index: number) => (
    <TouchableOpacity
      key={tenancy.id}
      style={[
        localStyles.tenancyListRow,
        index > 0 && localStyles.tenancyListRowDivider,
        editingTenancyId === tenancy.id && localStyles.tenancyListRowEditing,
      ]}
      onPress={() => openEditTenancy(tenancy)}
    >
      <View style={localStyles.titleRow}>
        <View style={localStyles.unitInfo}>
          <Text style={localStyles.optionText}>{unit ? unit.label : "Unitate ștearsă"}</Text>
          {unit ? <Text style={localStyles.unitTypeCaption}>{unitTypeLabel(unit.type)}</Text> : null}
        </View>
        <Text style={tenancy.associated ? localStyles.unitStatusAssociated : localStyles.unitStatusPending}>
          {tenancy.associated ? "Asociat" : "Neasociat"}
        </Text>
      </View>
      <Text style={localStyles.entityCaption}>
        Cost chirie (lunar): {tenancy.rentAmount} {tenancy.rentCurrency} · din {tenancy.startDate}
      </Text>
      <View style={localStyles.codeRow}>
        <Text style={localStyles.tenancyCode}>Cod de asociere: {tenancy.associationCode}</Text>
        <TouchableOpacity onPress={() => handleCopyCode(tenancy.id, tenancy.associationCode)} hitSlop={8}>
          <Text style={localStyles.action}>{copiedTenancyId === tenancy.id ? "Copiat ✓" : "Copiază"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={localStyles.codeCaption}>
        Acest cod trebuie transmis chiriașului pentru adăugarea unității în aplicația acestuia.
      </Text>
    </TouchableOpacity>
  );

  // Rendered once, after the entire tenancyList for whichever property group contains the tenancy
  // currently being edited (or after the orphans' list) — never nested inside a specific row.
  const renderTenancyEditForm = (tenancy: Tenancy, unit: Unit | undefined) => (
    <View style={localStyles.contractForm}>
      <Text style={localStyles.contractFormLabel}>
        Unitate chirie — {unitDisplayLabel(unit)}
      </Text>
      <Text style={styles.sectionLabel}>Data începere contract chirie</Text>
      <TextInput
        style={styles.input}
        placeholder="Dată început (ZZ-LL-AAAA)"
        keyboardType="numbers-and-punctuation"
        value={editStartDate}
        onChangeText={setEditStartDate}
      />
      {editStartDate.length > 0 && !editStartDateValid ? (
        <Text style={styles.error}>Format așteptat: ZZ-LL-AAAA</Text>
      ) : null}
      <Text style={styles.sectionLabel}>Cost chirie lunară</Text>
      <View style={localStyles.rentRow}>
        <TextInput
          style={[styles.input, localStyles.rentInput]}
          placeholder="Chirie"
          keyboardType="decimal-pad"
          value={editRentAmount}
          onChangeText={setEditRentAmount}
        />
        <Toggle options={CURRENCIES} value={editCurrency} onChange={setEditCurrency} />
      </View>
      <View style={localStyles.row}>
        <TouchableOpacity onPress={submitEditTenancy} disabled={!editValid}>
          <Text style={!editValid ? localStyles.actionMuted : localStyles.action}>Salvează</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteTenancy(tenancy, unit)}>
          <Text style={localStyles.actionDestructive}>Șterge</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={resetTenancyEdit}>
          <Text style={localStyles.actionMuted}>Anulează</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <FormScreen
      contentContainerStyle={[styles.container, styles.containerHeaderTop]}
      showBrand={false}
      longForm
      header={
        <>
          {availableUnits.length === 0 ? (
            <>
              <View style={[styles.sectionTrigger, styles.sectionTriggerDisabled]}>
                <Text style={[styles.sectionTriggerText, styles.sectionTriggerTextDisabled]}>+ Adaugă chirie</Text>
              </View>
              <Text style={[styles.hint, localStyles.headerHint]}>
                {units.length === 0
                  ? "Nu ai adăugat încă nicio unitate în portofoliu."
                  : "Toate unitățile din portofoliu sunt deja închiriate."}
              </Text>
            </>
          ) : !formOpen ? (
            <TouchableOpacity style={styles.sectionTrigger} onPress={() => setFormOpen(true)}>
              <Text style={styles.sectionTriggerText}>+ Adaugă chirie</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Selectează o unitate</Text>
              {propertiesWithAvailableUnits.map((property) => (
                <View key={property.id} style={localStyles.propertyGroup}>
                  <Text style={localStyles.propertyAddress}>{formatPropertyStreetLine(property)}</Text>
                  <Text style={localStyles.propertyLocality}>{formatPropertyLocalityLine(property)}</Text>
                  <View style={localStyles.unitList}>
                    {availableUnits
                      .filter((unit) => unit.propertyId === property.id)
                      .map((unit, index) => {
                        const unitLegalEntity = legalEntities.find((entity) => entity.id === unit.legalEntityId);
                        return (
                          <TouchableOpacity
                            key={unit.id}
                            style={[
                              localStyles.unitListRow,
                              index > 0 && localStyles.unitListRowDivider,
                              selectedUnitId === unit.id && localStyles.unitListRowSelected,
                            ]}
                            onPress={() => setSelectedUnitId(unit.id)}
                          >
                            <Text style={localStyles.unitOptionText}>{unit.label}</Text>
                            <Text style={localStyles.unitTypeCaption}>{unitTypeLabel(unit.type)}</Text>
                            <Text style={localStyles.unitEntityCaption}>{unitLegalEntity?.name ?? "—"}</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>

                  {/* Same pattern as Portofoliu's unit-edit form (Section 4.3) — one form at the bottom
                      of the whole list, not nested inside whichever row is selected; only that row's own
                      highlight (above) shows which unit it applies to. */}
                  {availableUnits.some((unit) => unit.propertyId === property.id && unit.id === selectedUnitId) ? (
                    <View style={localStyles.contractForm}>
                      <Text style={styles.sectionLabel}>Data începere contract chirie</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Dată început (ZZ-LL-AAAA)"
                        keyboardType="numbers-and-punctuation"
                        value={startDate}
                        onChangeText={setStartDate}
                      />
                      {startDate.length > 0 && !startDateValid ? (
                        <Text style={styles.error}>Format așteptat: ZZ-LL-AAAA</Text>
                      ) : null}

                      <Text style={styles.sectionLabel}>Cost chirie lunară</Text>
                      <View style={localStyles.rentRow}>
                        <TextInput
                          style={[styles.input, localStyles.rentInput]}
                          placeholder="Chirie"
                          keyboardType="decimal-pad"
                          value={rentAmount}
                          onChangeText={setRentAmount}
                        />
                        <Toggle options={CURRENCIES} value={currency} onChange={setCurrency} />
                      </View>

                      <View style={localStyles.row}>
                        <TouchableOpacity onPress={handleCreateTenancy} disabled={submitting || !formValid}>
                          <Text style={submitting || !formValid ? localStyles.actionMuted : localStyles.action}>
                            Creează chirie
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={resetForm}>
                          <Text style={localStyles.actionMuted}>Anulează</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </>
          )}
          <View style={localStyles.sectionDivider} />
        </>
      }
    >
      <Text style={styles.sectionLabel}>Chirii existente</Text>

      {tenancies.length === 0 && portfolioLoading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : tenancies.length === 0 && portfolioError ? (
        <Text style={styles.error}>{portfolioError}</Text>
      ) : tenancies.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio chirie creată.</Text>
      ) : (
        <>
          {propertiesWithTenancies.map((property) => {
            const groupEntries = tenanciesWithContext.filter((entry) => entry.property?.id === property.id);
            const editingEntry = groupEntries.find((entry) => entry.tenancy.id === editingTenancyId);
            return (
              <View key={property.id} style={localStyles.propertyGroup}>
                <Text style={localStyles.propertyAddress}>{formatPropertyStreetLine(property)}</Text>
                <Text style={localStyles.propertyLocality}>{formatPropertyLocalityLine(property)}</Text>
                <View style={localStyles.tenancyList}>
                  {groupEntries.map((entry, index) => renderTenancyTile(entry.tenancy, entry.unit, index))}
                </View>
                {editingEntry ? renderTenancyEditForm(editingEntry.tenancy, editingEntry.unit) : null}
              </View>
            );
          })}
          {orphanTenancies.length > 0 ? (
            <View style={localStyles.propertyGroup}>
              <View style={localStyles.tenancyList}>
                {orphanTenancies.map((entry, index) => renderTenancyTile(entry.tenancy, entry.unit, index))}
              </View>
              {(() => {
                const editingEntry = orphanTenancies.find((entry) => entry.tenancy.id === editingTenancyId);
                return editingEntry ? renderTenancyEditForm(editingEntry.tenancy, editingEntry.unit) : null;
              })()}
            </View>
          ) : null}
        </>
      )}
    </FormScreen>
  );
}

const localStyles = StyleSheet.create({
  // Cancels formStyles.hint's own marginBottom: 4 — the header View already spaces its children
  // with `gap: 8` (FormScreen.tsx), so without this override the hint-to-divider gap read as 4px
  // wider than the trigger-to-divider gap on the other screens (button has no such extra margin).
  headerHint: { marginBottom: 0 },
  // Marks the boundary between "add a tenancy" (unit picker + contract form) and "already-created
  // tenancies" below it — the two blocks otherwise share the same property-tile look and read as
  // one continuous list.
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#ccc", marginTop: 16 },
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
  // Pulled closer than the group's own `gap: 8` would give by default, so it reads as a sub-line of
  // the address above rather than a separate item.
  propertyLocality: { fontSize: 13, color: "#8e8e93", marginTop: -4 },
  // Multiple units/tenancies on the *same* property share one bordered box with hairline dividers
  // between rows — same pattern as Portofoliu's unit list under a property — instead of each getting
  // its own separate bordered tile (that read as too many nested boxes).
  unitList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", marginTop: 4 },
  unitListRow: { padding: 12 },
  unitListRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  // Fills the whole row (same padding box as unitListRow) rather than a smaller inset strip — the
  // Contract form expanding below it, in the same propertyGroup, stays on a plain background.
  unitListRowSelected: { backgroundColor: "#eaf1fd" },
  // Same shape as Portofoliu's unitForm — indented under the list it belongs to, small gap above
  // it rather than a full section break.
  contractForm: { gap: 8, paddingLeft: 12, marginTop: 2 },
  // sectionLabel's own marginTop: 8 (formStyles) is meant to hug a *section* above it — reused here
  // for a per-tenancy heading right under the list it edits, so it needs to hug that list instead.
  contractFormLabel: { color: "#8e8e93", fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 0 },
  // Chirie + monedă on one line — the amount field takes the remaining space, the currency options
  // sit narrow to its right instead of their own full-width row underneath.
  rentRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  rentInput: { flex: 1 },
  tenancyList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", marginTop: 4 },
  tenancyListRow: { padding: 12, gap: 4 },
  tenancyListRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  tenancyListRowEditing: { backgroundColor: "#eaf1fd" },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  tenancyCode: { fontSize: 15, fontWeight: "700" },
  codeCaption: { fontSize: 13, color: "#8e8e93", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  // Same text-link action row as Portofoliu's unit form (Salvează/Anulează/Șterge as plain links,
  // not a filled button + separate cancel link) — kept identical so both forms read as one pattern.
  action: { color: "#1a73e8", fontWeight: "600" },
  // Slightly bolder than plain text so Anulează reads a bit more prominently, still neutral grey.
  actionMuted: { color: "#8e8e93", fontWeight: "600" },
  actionDestructive: { color: "#d32f2f", fontWeight: "600" },
  // Explicit size/weight, not flex:1 — same as Portofoliu's unitLabel. flex:1 on the first child of
  // a column with no fixed height risked Yoga collapsing it to zero height in some cases.
  unitOptionText: { fontSize: 15, fontWeight: "600" },
  optionText: { fontSize: 16, fontWeight: "600" },
  // Wraps label + type so they stack as one block that the status badge (Asociat/Neasociat) can
  // center against, same as Portofoliu's unit rows.
  unitInfo: { flex: 1 },
  unitTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  // Third line, same as Portofoliu's unit rows — label / sub-type / legal entity.
  unitEntityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // Same visual language as Portofoliu's Închiriată/Liberă badge, but a different fact: whether the
  // tenant has entered the association_code in their own dashboard, not whether the unit has a
  // tenancy contract at all (a unit can be "Închiriată" with its tenancy still "Neasociat").
  unitStatusAssociated: { color: "#1a9e5c", fontSize: 12, fontWeight: "600" },
  unitStatusPending: { color: "#c77700", fontSize: 12, fontWeight: "600" },
  entityCaption: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
});
