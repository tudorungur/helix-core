import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { Toggle } from "../../components/Toggle";
import { usePortfolioStore } from "../../context/portfolioStore";
import type { LegalForm } from "../../context/portfolioStore";
import { validateCNP, validateCUI } from "../../validators/romanianFiscalId";

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

// Section 5.1 — Chiriaș's own Setări tab, symmetric with OwnerSettingsScreen (2026-07-27
// consolidation: legal_entities is no longer account-only — a tenant needs the same reusable
// identity to claim a tenancy under, PF or a company they control, instead of retyping a name/CUI
// on every claim). `userId`-scoped (`myLegalEntities`), not `accountId`-scoped — a tenant has no
// account at all. Same form shape as OwnerSettingsScreen minus `invoiceSeries` (pure issuer-side
// numbering, meaningless for an identity that never issues an invoice through this app). `vatPayer`
// *is* kept, unlike invoiceSeries: renting real estate is VAT-exempt by default in Romania (Cod
// Fiscal art. 292(2)(e)), and whether TVA appears on the invoice is the owner's own registration +
// "opțiune de taxare" election — never the tenant's — but the tenant's own VAT-payer status is still
// real information: it decides whether that TVA is neutral for the tenant (deductible, if
// VAT-registered) or a real cost (if not), which is exactly the kind of thing an owner weighs before
// opting in, and a VAT-registered company's CIF carries the "RO" prefix on an e-Factura, which needs
// this tracked as its own field rather than parsed back out of the CUI (mirrors why the owner's own
// `vatPayer` isn't derived from their CUI either). Kept as its own file rather than a shared
// component since the two screens already diverge (this field difference plus the delete-usage-check
// wording) and a shared abstraction would need parameters to route around both.
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [legalForm, setLegalForm] = useState<LegalForm | null>(null);
  // `name` is only used for business forms ("Denumire firmă") — Persoană Fizică collects Nume/Prenume
  // as two separate fields below, concatenated into the same `legal_entities.name` column on submit
  // (same pattern as OwnerSettingsScreen/SignUpScreen).
  const [name, setName] = useState("");
  const [nume, setNume] = useState("");
  const [prenume, setPrenume] = useState("");
  const [cui, setCui] = useState("");
  const [vatPayer, setVatPayer] = useState<boolean | null>(null);
  // Same duplicate-check race guard as OwnerSettingsScreen — see its own comment for the render-order
  // reasoning.
  const [submitting, setSubmitting] = useState(false);

  const isBusinessForm = legalForm !== null && legalForm !== "PF";
  const cuiValid = !isBusinessForm || validateCUI(cui);
  const cnpFilled = !isBusinessForm && cui.trim().length > 0;
  const cnpValid = !cnpFilled || validateCNP(cui);
  const normalizeCui = (value: string) => value.trim().replace(/^RO/i, "").toUpperCase();
  const cuiDuplicate =
    !submitting &&
    cui.trim().length > 0 &&
    myLegalEntities.some(
      (entity) =>
        entity.id !== editingId && entity.cuiCnp && normalizeCui(entity.cuiCnp) === normalizeCui(cui),
    );
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
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    const entity = myLegalEntities.find((e) => e.id === id);
    if (!entity) return;
    setEditingId(id);
    setLegalForm(entity.legalForm);
    if (entity.legalForm === "PF") {
      // Best-effort split on the first space — see OwnerSettingsScreen's openEdit for why an exact
      // round-trip isn't possible once Nume/Prenume are concatenated into one stored column.
      const spaceIndex = entity.name.indexOf(" ");
      setPrenume(spaceIndex === -1 ? entity.name : entity.name.slice(0, spaceIndex));
      setNume(spaceIndex === -1 ? "" : entity.name.slice(spaceIndex + 1));
    } else {
      setName(entity.name);
    }
    setCui(entity.cuiCnp ?? "");
    setVatPayer(entity.vatPayer ?? null);
    setFormOpen(true);
  };

  const handleApiError = (error: unknown) => {
    Alert.alert("Eroare", error instanceof Error ? error.message : "A apărut o eroare neașteptată.");
  };

  const submitForm = () => {
    if (!formValid || !legalForm) return;
    const fullName = isBusinessForm ? name.trim() : `${prenume.trim()} ${nume.trim()}`.trim();
    const input = {
      legalForm,
      name: fullName,
      cuiCnp: cui.trim() || null,
      vatPayer: isBusinessForm ? (vatPayer ?? undefined) : undefined,
    };
    if (editingId) {
      Alert.alert("Confirmi modificările?", `Se salvează modificările pentru ${fullName}.`, [
        { text: "Anulează", style: "cancel" },
        {
          text: "Confirmă",
          onPress: async () => {
            setSubmitting(true);
            try {
              await updateMyLegalEntity(editingId, input);
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
        await addMyLegalEntity(input);
        resetForm();
      } catch (error) {
        handleApiError(error);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const handleDelete = (id: string, entityName: string) => {
    // The owner-side equivalent warns about units using an entity; a tenant's entity is used by a
    // claimed tenancy instead (`tenancies.tenant_legal_entity_id`, no cascade) — same rationale.
    const tenancyCount = myTenancies.filter((tenancy) => tenancy.tenantLegalEntity.id === id).length;
    Alert.alert(
      "Ștergi entitatea legală?",
      tenancyCount > 0
        ? `${entityName} este folosită de ${tenancyCount} chirie/chirii. Va fi ștearsă definitiv.`
        : `${entityName} va fi ștearsă definitiv.`,
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMyLegalEntity(id);
            } catch (error) {
              handleApiError(error);
            }
          },
        },
      ],
    );
  };

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

      {myLegalEntities.length === 0 && myLegalEntitiesLoading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : myLegalEntities.length === 0 && myLegalEntitiesError ? (
        <Text style={styles.error}>{myLegalEntitiesError}</Text>
      ) : myLegalEntities.length === 0 ? (
        <Text style={styles.hint}>Nu ai încă nicio entitate legală adăugată.</Text>
      ) : (
        myLegalEntities.map((entity) =>
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
  actionMuted: { color: "#8e8e93", fontWeight: "600" },
  actionDestructive: { color: "#d32f2f", fontWeight: "600" },
  optionList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#ccc" },
  optionSelected: { backgroundColor: "#eaf1fd" },
  optionText: { flex: 1, fontWeight: "600" },
  optionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
  entityTypeCaption: { fontSize: 12, color: "#8e8e93", marginTop: -4 },
  entityCuiCaption: { fontSize: 12, color: "#8e8e93", marginTop: -4 },
});
