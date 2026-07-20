import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";

type Currency = "EUR" | "RON";

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "EUR", label: "EUR" },
  { value: "RON", label: "RON" },
];

// Excludes visually ambiguous characters (0/O, 1/I) — this code gets read off one screen and
// typed into another by hand.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAssociationCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Section 4.3/4.4, minimal slice — creates a property + unit + tenancy in one form (no utility
// toggles yet, that's the rest of §4.3, still unbuilt) and generates the association_code a tenant
// enters to link (§4.4). No backend exists yet (Section 4.1's note applies here too) — submitting
// just generates a code locally and shows it; nothing is persisted past the console.log below.
export function OwnerTenanciesScreen() {
  const [address, setAddress] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [associationCode, setAssociationCode] = useState<string | null>(null);

  const addressValid = address.trim().length > 0;
  const unitLabelValid = unitLabel.trim().length > 0;
  const startDateValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const rentAmountValid = rentAmount.trim().length > 0 && Number(rentAmount) > 0;
  const currencyValid = currency !== null;
  const formValid =
    addressValid && unitLabelValid && startDateValid && rentAmountValid && currencyValid;

  const handleCreateTenancy = () => {
    setSubmitting(true);
    // TODO(backend): no API exists yet — this is where the calls go once it does: create
    // `property(address)` → `unit(label)` → `tenancy(unit_id, start_date, rent_amount,
    // rent_currency)` with a generated `tenancies.association_code` (Section 4.4). For now the
    // code is generated locally and nothing above is persisted past this log line.
    const code = generateAssociationCode();
    console.log("Pending tenancy creation payload:", {
      address,
      unitLabel,
      startDate,
      rentAmount: Number(rentAmount),
      currency,
      associationCode: code,
    });
    setAssociationCode(code);
    setSubmitting(false);
  };

  if (associationCode) {
    return (
      <FormScreen contentContainerStyle={styles.container} showBrand={false}>
        <Text style={styles.sectionLabel}>Tenancy creat</Text>
        <Text style={resultStyles.code}>{associationCode}</Text>
        <Text style={styles.caption}>
          Trimite acest cod chiriașului — îl introduce la secțiunea lui de asociere ca să se lege
          de această unitate.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => setAssociationCode(null)}>
          <Text style={styles.buttonText}>Creează alt tenancy</Text>
        </TouchableOpacity>
      </FormScreen>
    );
  }

  return (
    <FormScreen contentContainerStyle={styles.container} showBrand={false}>
      <Text style={styles.sectionLabel}>Proprietate</Text>
      <TextInput style={styles.input} placeholder="Adresă" value={address} onChangeText={setAddress} />

      <Text style={styles.sectionLabel}>Unitate</Text>
      <TextInput
        style={styles.input}
        placeholder="Etichetă (ex: Ap. 3)"
        value={unitLabel}
        onChangeText={setUnitLabel}
      />

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

      <TouchableOpacity
        style={[styles.button, (submitting || !formValid) && styles.buttonDisabled]}
        onPress={handleCreateTenancy}
        disabled={submitting || !formValid}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Creează tenancy</Text>}
      </TouchableOpacity>
    </FormScreen>
  );
}

const resultStyles = StyleSheet.create({
  code: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
    marginVertical: 12,
  },
});
