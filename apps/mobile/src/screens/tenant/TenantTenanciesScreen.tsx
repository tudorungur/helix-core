import { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { usePortfolioStore } from "../../context/portfolioStore";

// Section 4.4, minimal slice — the tenant side of linking a tenancy: enter the association_code
// the owner generated (OwnerTenanciesScreen). No backend/tenancy_membership exists yet, but Owner
// and Tenant contexts share the same client-side `portfolioStore` in this app, so the code lookup
// and the resulting `tenancy.associated` flip are real, not mocked — the owner's Închirieri tiles
// show "Asociat"/"Neasociat" reflecting exactly what happens here. What's still missing: creating a
// `tenancy_membership` on this user, and the bilateral fiscal data collection (Section 4.4).
export function TenantTenanciesScreen() {
  const associateTenancyByCode = usePortfolioStore((state) => state.associateTenancyByCode);

  const [associationCode, setAssociationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeValid = associationCode.trim().length > 0;

  const handleAssociate = () => {
    setSubmitting(true);
    setError(null);
    // TODO(backend): no API exists yet — this is where the call goes once it does: resolve
    // `associationCode` to a `tenancy`, create a `tenancy_membership` on this user, then collect
    // the bilateral fiscal data (Section 4.4 — entity type, CUI/CNP) before the link finalizes.
    // For now `associateTenancyByCode` only flips local state on the shared portfolioStore.
    const result = associateTenancyByCode(associationCode);
    setSubmitting(false);
    if (result === "not_found") {
      setError("Codul nu corespunde niciunei chirii.");
      return;
    }
    if (result === "already_associated") {
      setError("Acest cod a fost deja folosit.");
      return;
    }
    setLinked(true);
  };

  if (linked) {
    return (
      <FormScreen contentContainerStyle={styles.container} showBrand={false}>
        <Text style={styles.sectionLabel}>Te-ai asociat</Text>
        <Text style={styles.hint}>
          Codul „{associationCode}” a fost validat — unitatea aferentă e acum marcată drept asociată.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setLinked(false);
            setAssociationCode("");
          }}
        >
          <Text style={styles.buttonText}>Introdu alt cod</Text>
        </TouchableOpacity>
      </FormScreen>
    );
  }

  return (
    <FormScreen contentContainerStyle={styles.container} showBrand={false}>
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

      <TouchableOpacity
        style={[styles.button, (submitting || !codeValid) && styles.buttonDisabled]}
        onPress={handleAssociate}
        disabled={submitting || !codeValid}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Asociază-te</Text>}
      </TouchableOpacity>
    </FormScreen>
  );
}
