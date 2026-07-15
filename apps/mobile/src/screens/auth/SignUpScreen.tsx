import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CognitoUser, CognitoUserAttribute } from "amazon-cognito-identity-js";

import { useAuthStore, userPool } from "../../auth/authStore";
import { validateCNP, validateCUI } from "../../validators/romanianFiscalId";

type LegalForm = "PF" | "PFA" | "SRL" | "SA";
type AccountType = "UNREGISTERED_INDIVIDUAL" | "B2C_INDIVIDUAL" | "B2B_COMPANY";

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: "PF", label: "Persoană Fizică" },
  { value: "PFA", label: "Persoană Fizică Autorizată (PFA)" },
  { value: "SRL", label: "Societate cu Răspundere Limitată (SRL)" },
  { value: "SA", label: "Societate pe Acțiuni (SA)" },
];

function accountTypeFor(legalForm: LegalForm): AccountType {
  if (legalForm === "PF") return "UNREGISTERED_INDIVIDUAL";
  if (legalForm === "PFA") return "B2C_INDIVIDUAL";
  return "B2B_COMPANY"; // SRL and SA — accounts.type doesn't distinguish them (Section 3.1)
}

// Section 4.1 — landlord self-registration. Cognito sign-up handles email/password; everything
// else here (accounts.type classification + fiscal data, Section 3.1) is captured up front so the
// account can be created fully-formed once a backend endpoint exists to receive it (none does
// yet — see the TODO after confirmRegistration below).
export function SignUpScreen() {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalForm, setLegalForm] = useState<LegalForm>("PF");
  const [legalName, setLegalName] = useState("");
  const [cuiCnp, setCuiCnp] = useState("");
  const [vatPayer, setVatPayer] = useState(false);
  const [invoiceSeries, setInvoiceSeries] = useState("");

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore((state) => state.signIn);

  const isCompanyOrPfa = legalForm !== "PF";
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const cuiCnpValid = isCompanyOrPfa ? validateCUI(cuiCnp) : validateCNP(cuiCnp);
  const invoiceSeriesValid = !isCompanyOrPfa || /^[A-Z0-9]{1,6}$/i.test(invoiceSeries);
  const legalNameValid = !isCompanyOrPfa || legalName.trim().length > 0;
  const formValid =
    email.trim().length > 0 &&
    passwordsMatch &&
    cuiCnpValid &&
    invoiceSeriesValid &&
    legalNameValid;

  const handleCreateAccount = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        userPool.signUp(
          email,
          password,
          [new CognitoUserAttribute({ Name: "email", Value: email })],
          [],
          (err, result) => {
            if (err || !result) {
              setError(err?.message ?? "Nu am putut crea contul");
              reject(err);
              return;
            }
            setCognitoUser(result.user);
            setStep("confirm");
            resolve();
          },
        );
      });
    } catch {
      // error state already set above
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!cognitoUser) return;
    setError(null);
    setSubmitting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        cognitoUser.confirmRegistration(code, true, (err) => {
          if (err) {
            setError(err.message ?? "Codul de confirmare este greșit");
            reject(err);
            return;
          }
          resolve();
        });
      });

      await signIn(email, password);

      // TODO(backend): no API exists yet to create `accounts` + `account_membership(role=OWNER)`
      // (Section 4.1) — this is where that call goes once the backend does. For now the
      // classification the user just filled in isn't persisted anywhere past this log line.
      console.log("Pending account creation payload:", {
        type: accountTypeFor(legalForm),
        legalName: isCompanyOrPfa ? legalName : undefined,
        cuiCnp: isCompanyOrPfa && vatPayer ? `RO${cuiCnp}` : cuiCnp,
        vatPayer: isCompanyOrPfa ? vatPayer : false,
        invoiceSeries: isCompanyOrPfa ? invoiceSeries : undefined,
      });
    } catch {
      // error state already set above
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "confirm") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.hint}>Am trimis un cod de confirmare la {email}.</Text>
        <TextInput
          style={styles.input}
          placeholder="Cod de confirmare"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (submitting || !code) && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={submitting || !code}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmă</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Nume utilizator (email)</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.caption}>Vei folosi acest email ca nume de utilizator la autentificare.</Text>

      <TextInput
        style={styles.input}
        placeholder="Parolă"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Repetă parola"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      {confirmPassword.length > 0 && !passwordsMatch ? (
        <Text style={styles.error}>Parolele nu coincid</Text>
      ) : null}

      <Text style={styles.sectionLabel}>Entitate legală</Text>
      <View style={styles.optionList}>
        {LEGAL_FORMS.map(({ value, label }, index) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.option,
              index > 0 && styles.optionDivider,
              legalForm === value && styles.optionSelected,
            ]}
            onPress={() => setLegalForm(value)}
          >
            <Text style={styles.optionText}>{label}</Text>
            {legalForm === value ? <Text style={styles.optionCheck}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Date fiscale</Text>

      {isCompanyOrPfa ? (
        <TextInput
          style={styles.input}
          placeholder="Denumire legală"
          value={legalName}
          onChangeText={setLegalName}
        />
      ) : null}

      {isCompanyOrPfa ? (
        <View style={styles.row}>
          <Text style={styles.label}>Plătitor de TVA</Text>
          <Switch value={vatPayer} onValueChange={setVatPayer} />
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder={isCompanyOrPfa ? (vatPayer ? "CUI (ex: RO12345678)" : "CUI (ex: 12345678)") : "CNP"}
        keyboardType="number-pad"
        value={cuiCnp}
        onChangeText={setCuiCnp}
      />
      {cuiCnp.length > 0 && !cuiCnpValid ? (
        <Text style={styles.error}>{isCompanyOrPfa ? "CUI invalid" : "CNP invalid"}</Text>
      ) : null}

      {isCompanyOrPfa ? (
        <TextInput
          style={styles.input}
          placeholder="Serie facturi"
          autoCapitalize="characters"
          value={invoiceSeries}
          onChangeText={setInvoiceSeries}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, (submitting || !formValid) && styles.buttonDisabled]}
        onPress={handleCreateAccount}
        disabled={submitting || !formValid}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Creează cont</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 32, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  button: { backgroundColor: "#1a73e8", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#d32f2f", marginTop: -6 },
  hint: { color: "#555", marginBottom: 4 },
  caption: { color: "#8e8e93", fontSize: 13, marginTop: -6, marginBottom: 4 },
  sectionLabel: {
    color: "#8e8e93",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  label: { flex: 1, marginRight: 12 },
  optionList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#ccc" },
  optionSelected: { backgroundColor: "#eaf1fd" },
  optionText: { flex: 1 },
  optionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
});
