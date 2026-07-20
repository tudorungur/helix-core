import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CognitoUser, CognitoUserAttribute } from "amazon-cognito-identity-js";

import { useAuthStore, userPool } from "../../auth/authStore";
import { FormScreen } from "../../components/FormScreen";

type Role = "OWNER" | "TENANT";
type LegalForm = "PF" | "PFA" | "II" | "IF" | "SRL" | "SA";
type AccountType = "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY";

const ROLES: { value: Role; label: string }[] = [
  { value: "OWNER", label: "Proprietar" },
  { value: "TENANT", label: "Chiriaș" },
];

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: "PF", label: "Persoană Fizică" },
  { value: "PFA", label: "Persoană Fizică Autorizată (PFA)" },
  { value: "II", label: "Întreprindere Individuală (II)" },
  { value: "IF", label: "Întreprindere Familială (IF)" },
  { value: "SRL", label: "Societate cu Răspundere Limitată (SRL)" },
  { value: "SA", label: "Societate pe Acțiuni (SA)" },
];

function accountTypeFor(legalForm: LegalForm): AccountType {
  if (legalForm === "PF") return "UNREGISTERED_INDIVIDUAL";
  // PFA, II, IF — the three sibling forms under OUG 44/2008, none with legal personality, all
  // CUI-bearing and taxed the same way; accounts.type doesn't distinguish them (Section 3.1).
  // Naming is about fiscal registration, not the B2B/B2C tenancy shorthand — a REGISTERED_INDIVIDUAL
  // landlord can rent to a company (B2B) just as freely as a REGISTERED_COMPANY one (Section 1).
  if (legalForm === "PFA" || legalForm === "II" || legalForm === "IF") return "REGISTERED_INDIVIDUAL";
  return "REGISTERED_COMPANY"; // SRL and SA — accounts.type doesn't distinguish them either
}

// Section 4.1/4.4 — landlord and tenant self-registration share this form, split by a role choice
// up front. Both roles pick a legal form and give their name — either can genuinely be any of PF/
// PFA/II/IF/SRL/SA — but neither answers any *fiscal* question here (CUI/CNP, legal_name, vat_payer,
// invoice_series): none of it is needed yet at signup, and Legea 190/2018 art. 4 + GDPR data
// minimization argue against gathering it speculatively. It's collected bilaterally, from both
// sides, only once a tenancy actually gets created/linked (Section 4.4) — reached from inside the
// app afterward (Proprietar: add a tenancy on a unit; Chiriaș: enter the resulting code), not during
// sign-up. That in-app flow isn't built yet — property/unit CRUD (Section 4.3) doesn't exist yet
// either, and a tenancy needs a unit to live on.
export function SignUpScreen() {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // null = not yet answered — a role this consequential shouldn't have a silent default either.
  const [role, setRole] = useState<Role | null>(null);
  const [legalForm, setLegalForm] = useState<LegalForm>("PF");
  const [nume, setNume] = useState("");
  const [prenume, setPrenume] = useState("");
  const [denumire, setDenumire] = useState("");

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore((state) => state.signIn);

  const isPersonalForm = legalForm === "PF";

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const roleValid = role !== null;
  const numeValid = !isPersonalForm || nume.trim().length > 0;
  const prenumeValid = !isPersonalForm || prenume.trim().length > 0;
  const denumireValid = isPersonalForm || denumire.trim().length > 0;
  const formValid =
    email.trim().length > 0 && passwordsMatch && roleValid && numeValid && prenumeValid && denumireValid;

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

      // TODO(backend): no API exists yet — this is where the call goes once it does. OWNER: create
      // `accounts(type, name)` + `account_membership(role=OWNER)` (Section 4.1) — fiscal fields
      // (legal_name, cui_cnp, vat_payer, invoice_series) stay NULL until the first tenancy needs
      // them (Section 4.4). TENANT: just a `users` row for now — they have no account/tenancy yet,
      // that's created later when they add a tenancy via the association code from inside the app
      // (Section 4.4, also not built yet). For now nothing filled in here is persisted past this log.
      const name = isPersonalForm ? `${prenume.trim()} ${nume.trim()}`.trim() : denumire;
      console.log("Pending user creation payload:", {
        role,
        legalForm,
        name,
        type: role === "OWNER" ? accountTypeFor(legalForm) : undefined,
      });
    } catch {
      // error state already set above
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "confirm") {
    return (
      <FormScreen contentContainerStyle={styles.container} longForm>
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
      </FormScreen>
    );
  }

  return (
    <FormScreen contentContainerStyle={styles.container} longForm>
      <Text style={styles.sectionLabel}>Nume utilizator</Text>
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

      <Text style={styles.sectionLabel}>Rol</Text>
      <View style={styles.choiceRow}>
        {ROLES.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            style={[styles.choiceOption, role === value && styles.choiceOptionSelected]}
            onPress={() => setRole(value)}
          >
            <Text style={[styles.choiceOptionText, role === value && styles.choiceOptionTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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

      {isPersonalForm ? (
        <>
          <Text style={styles.sectionLabel}>Date personale</Text>
          <TextInput style={styles.input} placeholder="Nume" value={nume} onChangeText={setNume} />
          <TextInput style={styles.input} placeholder="Prenume" value={prenume} onChangeText={setPrenume} />
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Denumire</Text>
          <TextInput
            style={styles.input}
            placeholder="Denumire"
            value={denumire}
            onChangeText={setDenumire}
          />
          <Text style={styles.caption}>
            CUI-ul și celelalte date fiscale se cer când se creează sau se leagă primul tenancy, nu acum.
          </Text>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, (submitting || !formValid) && styles.buttonDisabled]}
        onPress={handleCreateAccount}
        disabled={submitting || !formValid}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Creează cont</Text>}
      </TouchableOpacity>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 32, gap: 12 },
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
    letterSpacing: 0.5,
    marginTop: 8,
  },
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  choiceOptionSelected: { backgroundColor: "#1a73e8" },
  choiceOptionText: { color: "#1a73e8", fontWeight: "600" },
  choiceOptionTextSelected: { color: "#fff" },
  optionList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#ccc" },
  optionSelected: { backgroundColor: "#eaf1fd" },
  optionText: { flex: 1 },
  optionCheck: { color: "#1a73e8", fontWeight: "700", fontSize: 16 },
});
