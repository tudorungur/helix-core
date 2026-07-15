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

type LegalForm = "PFA" | "SRL";
type AccountType = "UNREGISTERED_INDIVIDUAL" | "B2C_INDIVIDUAL" | "B2B_COMPANY";

function accountTypeFor(fiscallyRegistered: boolean, legalForm: LegalForm): AccountType {
  if (!fiscallyRegistered) return "UNREGISTERED_INDIVIDUAL";
  return legalForm === "PFA" ? "B2C_INDIVIDUAL" : "B2B_COMPANY";
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
  const [fiscallyRegistered, setFiscallyRegistered] = useState(false);
  const [legalForm, setLegalForm] = useState<LegalForm>("PFA");
  const [legalName, setLegalName] = useState("");
  const [cuiCnp, setCuiCnp] = useState("");
  const [vatPayer, setVatPayer] = useState(false);
  const [invoiceSeries, setInvoiceSeries] = useState("");

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore((state) => state.signIn);

  const cuiCnpValid = fiscallyRegistered ? validateCUI(cuiCnp) : validateCNP(cuiCnp);
  const invoiceSeriesValid = !fiscallyRegistered || /^[A-Z0-9]{1,6}$/i.test(invoiceSeries);
  const legalNameValid = !fiscallyRegistered || legalName.trim().length > 0;
  const formValid = email.trim().length > 0 && password.length > 0 && cuiCnpValid && invoiceSeriesValid && legalNameValid;

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
        type: accountTypeFor(fiscallyRegistered, legalForm),
        legalName: fiscallyRegistered ? legalName : undefined,
        cuiCnp,
        vatPayer: fiscallyRegistered ? vatPayer : false,
        invoiceSeries: fiscallyRegistered ? invoiceSeries : undefined,
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
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Parolă"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.row}>
        <Text style={styles.label}>Persoană fizică înregistrată fiscal (PFA/SRL)?</Text>
        <Switch value={fiscallyRegistered} onValueChange={setFiscallyRegistered} />
      </View>

      {fiscallyRegistered ? (
        <View style={styles.segmented}>
          {(["PFA", "SRL"] as const).map((form) => (
            <TouchableOpacity
              key={form}
              style={[styles.segment, legalForm === form && styles.segmentActive]}
              onPress={() => setLegalForm(form)}
            >
              <Text style={[styles.segmentText, legalForm === form && styles.segmentTextActive]}>{form}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {fiscallyRegistered ? (
        <TextInput
          style={styles.input}
          placeholder="Denumire legală"
          value={legalName}
          onChangeText={setLegalName}
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder={fiscallyRegistered ? "CUI" : "CNP"}
        keyboardType="number-pad"
        value={cuiCnp}
        onChangeText={setCuiCnp}
      />
      {cuiCnp.length > 0 && !cuiCnpValid ? (
        <Text style={styles.error}>{fiscallyRegistered ? "CUI invalid" : "CNP invalid"}</Text>
      ) : null}

      {fiscallyRegistered ? (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Plătitor de TVA</Text>
            <Switch value={vatPayer} onValueChange={setVatPayer} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Serie facturi"
            autoCapitalize="characters"
            value={invoiceSeries}
            onChangeText={setInvoiceSeries}
          />
        </>
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
  container: { flexGrow: 1, padding: 24, paddingTop: 48, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  button: { backgroundColor: "#1a73e8", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#d32f2f" },
  hint: { color: "#555", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  label: { flex: 1, marginRight: 12 },
  segmented: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: "#1a73e8" },
  segmentText: { color: "#1a73e8", fontWeight: "600" },
  segmentTextActive: { color: "#fff" },
});
