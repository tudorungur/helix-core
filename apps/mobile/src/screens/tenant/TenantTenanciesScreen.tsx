import { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";

// Section 4.4, minimal slice — the tenant side of linking a tenancy: enter the association_code
// the owner generated (OwnerTenanciesScreen). No backend exists yet to actually resolve the code
// to a tenancy and create a tenancy_membership — this just validates the code isn't empty and
// shows a mocked success state, logging what a real submission would send.
export function TenantTenanciesScreen() {
  const [associationCode, setAssociationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [linked, setLinked] = useState(false);

  const codeValid = associationCode.trim().length > 0;

  const handleAssociate = () => {
    setSubmitting(true);
    // TODO(backend): no API exists yet — this is where the call goes once it does: resolve
    // `associationCode` to a `tenancy`, create a `tenancy_membership` on this user, then collect
    // the bilateral fiscal data (Section 4.4 — entity type, CUI/CNP) before the link finalizes.
    // For now nothing is persisted past this log line.
    console.log("Pending tenancy association payload:", { associationCode });
    setLinked(true);
    setSubmitting(false);
  };

  if (linked) {
    return (
      <FormScreen contentContainerStyle={styles.container} showBrand={false}>
        <Text style={styles.sectionLabel}>Te-ai asociat</Text>
        <Text style={styles.hint}>
          Codul „{associationCode}” a fost trimis. (Simulat — fără backend încă; nimic nu e salvat
          real momentan.)
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => setLinked(false)}>
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
