import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { formStyles as styles } from "./formStyles";
import { FormScreen } from "./FormScreen";
import { Toggle } from "./Toggle";
import { validateCNP, validateCUI } from "../validators/romanianFiscalId";
import type { LegalEntity, LegalEntityInput, LegalForm } from "../context/portfolioStore";

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

type Props = {
  entities: LegalEntity[];
  loading: boolean;
  error: string | null;
  // Owner's own entities collect an invoice series (issuer-side numbering); a tenant's own never
  // do, since a tenant never issues an invoice through this app (see TenantSettingsScreen's own
  // history for why vatPayer stayed but invoiceSeries didn't).
  showInvoiceSeries: boolean;
  // Literal "singular/plural" string as already shown to the user (e.g. "unitate/unități" or
  // "chirie/chirii") — not pluralized dynamically, matches the pre-extraction behavior exactly.
  usageNoun: string;
  countUsage: (entityId: string) => number;
  onAdd: (input: LegalEntityInput) => Promise<LegalEntity>;
  onUpdate: (id: string, input: LegalEntityInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

// Section 5.1 — shared by OwnerSettingsScreen and TenantSettingsScreen (extracted 2026-07-28, once
// the two screens' field sets converged again after vatPayer came back to the tenant side — see
// [[project_helix_core_tax_compliance]]). Add/edit/delete only, no selection/filter: business forms
// collect CUI/VAT(/invoice series, owner only) right away, Persoană Fizică collects Nume/Prenume as
// separate fields (not concatenated — see schema.ts's `legal_entities.first_name` note for why) plus
// an optional CNP. Editing happens in-place, in the same tile, same as units in Portofoliu.
export function LegalEntitiesEditor({
  entities,
  loading,
  error,
  showInvoiceSeries,
  usageNoun,
  countUsage,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [legalForm, setLegalForm] = useState<LegalForm | null>(null);
  // `name` is only used for business forms ("Denumire firmă") — Persoană Fizică sends `nume`/`prenume`
  // as their own separate fields instead.
  const [name, setName] = useState("");
  const [nume, setNume] = useState("");
  const [prenume, setPrenume] = useState("");
  const [cui, setCui] = useState("");
  const [vatPayer, setVatPayer] = useState<boolean | null>(null);
  const [invoiceSeries, setInvoiceSeries] = useState("");
  // Set for the span of an add/update request. Guards `cuiDuplicate` below: once `onAdd` resolves,
  // the store appends the just-created entity to `entities` (its `cuiCnp` is, by definition,
  // whatever we just typed) — but that's a separate state update from `resetForm()`'s `setCui("")`,
  // so for one render the new entity is in the list *and* the form still shows the same CUI, which
  // briefly (and wrongly) flags itself as a duplicate. Suppressing the check while `submitting` is
  // true covers exactly that window.
  const [submitting, setSubmitting] = useState(false);

  const isBusinessForm = legalForm !== null && legalForm !== "PF";
  const cuiValid = !isBusinessForm || validateCUI(cui);
  // CNP is optional for Persoană Fizică (§4.1's data-minimization rationale), unlike CUI which is
  // required immediately for business forms. `cui` doubles as the CNP field here — same underlying
  // `legal_entities.cui_cnp` column either way, one text field, not two parallel ones.
  const cnpFilled = !isBusinessForm && cui.trim().length > 0;
  const cnpValid = !cnpFilled || validateCNP(cui);
  const normalizeCui = (value: string) => value.trim().replace(/^RO/i, "").toUpperCase();
  // Uniqueness applies to both CUI and CNP (same column, same DB constraint) — not just business
  // forms.
  const cuiDuplicate =
    !submitting &&
    cui.trim().length > 0 &&
    entities.some((entity) => entity.id !== editingId && entity.cuiCnp && normalizeCui(entity.cuiCnp) === normalizeCui(cui));
  const formValid =
    legalForm !== null &&
    (isBusinessForm ? name.trim().length > 0 : nume.trim().length > 0 && prenume.trim().length > 0) &&
    (isBusinessForm
      ? cuiValid && !cuiDuplicate && vatPayer !== null
      : !cnpFilled || (cnpValid && !cuiDuplicate));

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setLegalForm(null);
    setName("");
    setNume("");
    setPrenume("");
    setCui("");
    setVatPayer(null);
    setInvoiceSeries("");
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    const entity = entities.find((e) => e.id === id);
    if (!entity) return;
    setEditingId(id);
    setLegalForm(entity.legalForm);
    if (entity.legalForm === "PF") {
      setPrenume(entity.firstName ?? "");
      setNume(entity.lastName ?? "");
    } else {
      setName(entity.name);
    }
    setCui(entity.cuiCnp ?? "");
    setVatPayer(entity.vatPayer ?? null);
    setInvoiceSeries(entity.invoiceSeries ?? "");
    setFormOpen(true);
  };

  const handleApiError = (apiError: unknown) => {
    Alert.alert("Eroare", apiError instanceof Error ? apiError.message : "A apărut o eroare neașteptată.");
  };

  const submitForm = () => {
    if (!formValid || !legalForm) return;
    // `null`, not `undefined`, whenever a field is empty — omitting a PATCH key means "don't touch
    // this column" server-side (Drizzle skips undefined fields in `.set()`), which silently failed
    // to clear a previously-set CNP/invoice series when the user emptied the field and saved: the
    // old value just stayed in the DB, and the response overwrote the local "cleared" state right
    // back to the stale value.
    const fullName = isBusinessForm ? name.trim() : `${prenume.trim()} ${nume.trim()}`.trim();
    const input = {
      legalForm,
      name: isBusinessForm ? name.trim() : undefined,
      firstName: isBusinessForm ? undefined : prenume.trim(),
      lastName: isBusinessForm ? undefined : nume.trim(),
      cuiCnp: cui.trim() || null,
      vatPayer: isBusinessForm ? (vatPayer ?? undefined) : undefined,
      invoiceSeries: showInvoiceSeries ? invoiceSeries.trim() || null : undefined,
    };
    if (editingId) {
      // Confirm before overwriting an existing legal entity's data — easy to fat-finger a field
      // like invoice series without noticing.
      Alert.alert("Confirmi modificările?", `Se salvează modificările pentru ${fullName}.`, [
        { text: "Anulează", style: "cancel" },
        {
          text: "Confirmă",
          onPress: async () => {
            setSubmitting(true);
            try {
              await onUpdate(editingId, input);
              resetForm();
            } catch (submitError) {
              handleApiError(submitError);
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
        await onAdd(input);
        resetForm();
      } catch (submitError) {
        handleApiError(submitError);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const handleDelete = (id: string, entityName: string) => {
    const usageCount = countUsage(id);
    Alert.alert(
      "Ștergi entitatea legală?",
      usageCount > 0
        ? `${entityName} este folosită de ${usageCount} ${usageNoun}. Va fi ștearsă definitiv.`
        : `${entityName} va fi ștearsă definitiv.`,
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              await onDelete(id);
            } catch (deleteError) {
              handleApiError(deleteError);
            }
          },
        },
      ],
    );
  };

  // Shared fields between the "add new" form (top of screen) and an entity's own inline edit form
  // (editing happens in-place, in the same tile, same as units in Portofoliu).
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
          {isBusinessForm ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Denumire firmă"
                value={name}
                onChangeText={setName}
              />

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

              {showInvoiceSeries ? (
                <TextInput
                  style={styles.input}
                  placeholder="Serie facturi (opțional)"
                  autoCapitalize="characters"
                  value={invoiceSeries}
                  onChangeText={setInvoiceSeries}
                />
              ) : null}
            </>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="Nume" value={nume} onChangeText={setNume} />
              <TextInput
                style={styles.input}
                placeholder="Prenume"
                value={prenume}
                onChangeText={setPrenume}
              />

              <TextInput
                style={styles.input}
                placeholder="CNP (opțional)"
                keyboardType="number-pad"
                maxLength={13}
                value={cui}
                onChangeText={setCui}
              />
              {cui.length > 0 && !cnpValid ? <Text style={styles.error}>CNP invalid</Text> : null}
              {cui.length > 0 && cnpValid && cuiDuplicate ? (
                <Text style={styles.error}>Acest CNP e deja folosit de altă entitate legală</Text>
              ) : null}
            </>
          )}
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

      {entities.length === 0 && loading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : entities.length === 0 && error ? (
        <Text style={styles.error}>{error}</Text>
      ) : entities.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio entitate legală adăugată.</Text>
      ) : (
        entities.map((entity) =>
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
                <Text style={localStyles.entityCuiCaption}>
                  {entity.legalForm === "PF" ? "CNP" : "CUI"} {entity.cuiCnp}
                </Text>
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
  // Marks the boundary between "add an entity" (trigger/form) and the existing entities below.
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
  // Pulled closer than the parent card's own `gap: 8` would give by default.
  entityTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: -4 },
  entityCuiCaption: { fontSize: 12, color: "#8e8e93", marginTop: -4 },
});
