import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { Toggle } from "../../components/Toggle";
import { usePortfolioStore } from "../../context/portfolioStore";
import type { LegalForm } from "../../context/portfolioStore";
import { validateCUI } from "../../validators/romanianFiscalId";

const VAT_OPTIONS: [{ value: "YES" | "NO"; label: string }, { value: "YES" | "NO"; label: string }] = [
  { value: "YES", label: "Da" },
  { value: "NO", label: "Nu" },
];

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: "PF", label: "Persoană Fizică" },
  { value: "PFA", label: "Persoană Fizică Autorizată (PFA)" },
  { value: "II", label: "Întreprindere Individuală (II)" },
  { value: "IF", label: "Întreprindere Familială (IF)" },
  { value: "SRL", label: "Societate cu Răspundere Limitată (SRL)" },
  { value: "SA", label: "Societate pe Acțiuni (SA)" },
];

// Section 5.1 — Setări tab. Entități legale live here now, not in a persistent cross-tab header
// (that version was removed — the filter/collapse behavior added complexity nobody wanted, and
// squeezing it above every OwnerTabs screen risked layout bugs). Add/edit/delete only, no
// selection/filter: business forms collect CUI/VAT/invoice series right away (no purpose without a
// CUI, duplicate CUI against another of the account's own legal entities is rejected inline),
// Persoană Fizică just takes a name — CNP stays deferred to the entity's first tenancy (§4.4).
export function OwnerSettingsScreen() {
  const legalEntities = usePortfolioStore((state) => state.legalEntities);
  const units = usePortfolioStore((state) => state.units);
  const portfolioLoading = usePortfolioStore((state) => state.loading);
  const portfolioError = usePortfolioStore((state) => state.error);
  const addLegalEntity = usePortfolioStore((state) => state.addLegalEntity);
  const updateLegalEntity = usePortfolioStore((state) => state.updateLegalEntity);
  const deleteLegalEntity = usePortfolioStore((state) => state.deleteLegalEntity);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [legalForm, setLegalForm] = useState<LegalForm | null>(null);
  const [name, setName] = useState("");
  const [cui, setCui] = useState("");
  const [vatPayer, setVatPayer] = useState<boolean | null>(null);
  const [invoiceSeries, setInvoiceSeries] = useState("");
  // Set for the span of an add/update request. Guards `cuiDuplicate` below: once `addLegalEntity`
  // resolves, the store appends the just-created entity to `legalEntities` (its `cuiCnp` is, by
  // definition, whatever we just typed) — but that's a separate state update from `resetForm()`'s
  // `setCui("")`, so for one render the new entity is in the list *and* the form still shows the
  // same CUI, which briefly (and wrongly) flags itself as a duplicate. Suppressing the check while
  // `submitting` is true covers exactly that window.
  const [submitting, setSubmitting] = useState(false);

  const isBusinessForm = legalForm !== null && legalForm !== "PF";
  const cuiValid = !isBusinessForm || validateCUI(cui);
  const normalizeCui = (value: string) => value.trim().replace(/^RO/i, "").toUpperCase();
  const cuiDuplicate =
    !submitting &&
    isBusinessForm &&
    cui.trim().length > 0 &&
    legalEntities.some(
      (entity) =>
        entity.id !== editingId && entity.cuiCnp && normalizeCui(entity.cuiCnp) === normalizeCui(cui),
    );
  const formValid =
    legalForm !== null &&
    name.trim().length > 0 &&
    (!isBusinessForm || (cuiValid && !cuiDuplicate && vatPayer !== null));

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setLegalForm(null);
    setName("");
    setCui("");
    setVatPayer(null);
    setInvoiceSeries("");
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    const entity = legalEntities.find((e) => e.id === id);
    if (!entity) return;
    setEditingId(id);
    setLegalForm(entity.legalForm);
    setName(entity.name);
    setCui(entity.cuiCnp ?? "");
    setVatPayer(entity.vatPayer ?? null);
    setInvoiceSeries(entity.invoiceSeries ?? "");
    setFormOpen(true);
  };

  const handleApiError = (error: unknown) => {
    Alert.alert("Eroare", error instanceof Error ? error.message : "A apărut o eroare neașteptată.");
  };

  const submitForm = () => {
    if (!formValid || !legalForm) return;
    const input = {
      legalForm,
      name: name.trim(),
      cuiCnp: isBusinessForm ? cui.trim() : undefined,
      vatPayer: isBusinessForm ? (vatPayer ?? undefined) : undefined,
      invoiceSeries: isBusinessForm && invoiceSeries.trim() ? invoiceSeries.trim() : undefined,
    };
    if (editingId) {
      // Confirm before overwriting an existing legal entity's data — easy to fat-finger a field
      // like invoice series without noticing.
      Alert.alert("Confirmi modificările?", `Se salvează modificările pentru ${name.trim()}.`, [
        { text: "Anulează", style: "cancel" },
        {
          text: "Confirmă",
          onPress: async () => {
            setSubmitting(true);
            try {
              await updateLegalEntity(editingId, input);
              resetForm();
            } catch (error) {
              handleApiError(error);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]);
      return;
    }
    setSubmitting(true);
    (async () => {
      try {
        await addLegalEntity(input);
        resetForm();
      } catch (error) {
        handleApiError(error);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const handleDelete = (id: string, entityName: string) => {
    const unitCount = units.filter((unit) => unit.legalEntityId === id).length;
    Alert.alert(
      "Ștergi entitatea legală?",
      unitCount > 0
        ? `${entityName} este folosită de ${unitCount} unitate/unități. Va fi ștearsă definitiv.`
        : `${entityName} va fi ștearsă definitiv.`,
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteLegalEntity(id);
            } catch (error) {
              handleApiError(error);
            }
          },
        },
      ],
    );
  };

  // Shared fields between the "add new" form (top of screen) and an entity's own inline edit form
  // (Section 5.1 — editing happens in-place, in the same tile, same as units in Portofoliu, not in
  // a form detached from the entity it belongs to).
  const renderFormFields = () => (
    <>
      <Text style={styles.sectionLabel}>Formă legală</Text>
      <View style={localStyles.optionList}>
        {LEGAL_FORMS.map(({ value, label }, index) => (
          <TouchableOpacity
            key={value}
            style={[
              localStyles.option,
              index > 0 && localStyles.optionDivider,
              legalForm === value && localStyles.optionSelected,
            ]}
            onPress={() => setLegalForm(value)}
          >
            <Text style={localStyles.optionText}>{label}</Text>
            {legalForm === value ? <Text style={localStyles.optionCheck}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      {legalForm ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={isBusinessForm ? "Denumire firmă" : "Nume și prenume"}
            value={name}
            onChangeText={setName}
          />

          {isBusinessForm ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="CUI"
                autoCapitalize="characters"
                value={cui}
                onChangeText={setCui}
              />
              {cui.length > 0 && !cuiValid ? <Text style={styles.error}>CUI invalid</Text> : null}
              {cui.length > 0 && cuiValid && cuiDuplicate ? (
                <Text style={styles.error}>Acest CUI e deja folosit de altă entitate legală</Text>
              ) : null}

              <Toggle
                label="Plătitor de TVA"
                options={VAT_OPTIONS}
                value={vatPayer === null ? null : vatPayer ? "YES" : "NO"}
                onChange={(value) => setVatPayer(value === "YES")}
              />

              <TextInput
                style={styles.input}
                placeholder="Serie facturi (opțional)"
                autoCapitalize="characters"
                value={invoiceSeries}
                onChangeText={setInvoiceSeries}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <FormScreen
      contentContainerStyle={[styles.container, styles.containerHeaderTop]}
      showBrand={false}
      longForm
      header={
        <>
          <Text style={styles.sectionLabel}>Entități legale</Text>
          {formOpen && editingId === null ? (
            <View style={localStyles.card}>
              {renderFormFields()}
              <View style={localStyles.row}>
                <TouchableOpacity onPress={submitForm} disabled={!formValid}>
                  <Text style={!formValid ? localStyles.actionMuted : localStyles.action}>
                    Adaugă entitate legală
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetForm}>
                  <Text style={localStyles.actionMuted}>Anulează</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.sectionTrigger} onPress={openAdd}>
              <Text style={styles.sectionTriggerText}>+ Adaugă entitate legală</Text>
            </TouchableOpacity>
          )}
          <View style={localStyles.sectionDivider} />
        </>
      }
    >
      <Text style={styles.sectionLabel}>Entități legale existente</Text>

      {legalEntities.length === 0 && portfolioLoading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : legalEntities.length === 0 && portfolioError ? (
        <Text style={styles.error}>{portfolioError}</Text>
      ) : legalEntities.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio entitate legală adăugată.</Text>
      ) : (
        legalEntities.map((entity) =>
          editingId === entity.id ? (
            <View key={entity.id} style={[localStyles.card, localStyles.cardEditing]}>
              {renderFormFields()}
              <View style={localStyles.row}>
                <TouchableOpacity onPress={submitForm} disabled={!formValid}>
                  <Text style={!formValid ? localStyles.actionMuted : localStyles.action}>Salvează</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entity.id, entity.name)}>
                  <Text style={localStyles.actionDestructive}>Șterge</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetForm}>
                  <Text style={localStyles.actionMuted}>Anulează</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View key={entity.id} style={localStyles.card}>
              <Text style={localStyles.optionText}>{entity.name}</Text>
              <Text style={localStyles.entityTypeCaption}>
                {LEGAL_FORMS.find((f) => f.value === entity.legalForm)?.label}
              </Text>
              {entity.cuiCnp ? (
                <Text style={localStyles.entityCuiCaption}>CUI {entity.cuiCnp}</Text>
              ) : null}
              <View style={localStyles.row}>
                <TouchableOpacity onPress={() => openEdit(entity.id)}>
                  <Text style={localStyles.action}>Editează</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entity.id, entity.name)}>
                  <Text style={localStyles.actionDestructive}>Șterge</Text>
                </TouchableOpacity>
              </View>
            </View>
          ),
        )
      )}
    </FormScreen>
  );
}

const localStyles = StyleSheet.create({
  // Marks the boundary between "add an entity" (trigger/form) and the existing entities below —
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
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  action: { color: "#1a73e8", fontWeight: "600" },
  // Slightly bolder than plain text so Anulează reads a bit more prominently, still neutral grey.
  actionMuted: { color: "#8e8e93", fontWeight: "600" },
  actionDestructive: { color: "#d32f2f", fontWeight: "600" },
  optionList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#ccc" },
  optionSelected: { backgroundColor: "#eaf1fd" },
  optionText: { flex: 1, fontWeight: "600" },
  optionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
  // Pulled closer than the parent card's own `gap: 8` would give by default — same tight spacing as
  // Proprietăți/Închirieri's județ/oraș line under stradă/număr.
  entityTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: -4 },
  entityCuiCaption: { fontSize: 12, color: "#8e8e93", marginTop: -4 },
});
