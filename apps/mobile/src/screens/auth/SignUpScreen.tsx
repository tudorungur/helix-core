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
import { useContextStore } from "../../context/contextStore";

type Role = "OWNER" | "TENANT";

const ROLES: { value: Role; label: string }[] = [
  { value: "OWNER", label: "Proprietar" },
  { value: "TENANT", label: "Chiriaș" },
];

// Section 4.1 — landlord and tenant self-registration share this form, split by a role choice, plus
// the person's own name. Neither role answers a legal-form or *fiscal* question here (CUI/CNP,
// legal_name, vat_payer, invoice_series) — that moved out of signup entirely: for Proprietar it's
// asked per legal_entity, when adding a property that needs one (Section 4.3, "Firme" in
// Portofoliu); for Chiriaș it's asked per tenancy, when linking one (Section 4.4). A single
// signup-time choice was wrong in the first place — the same person can act through different legal
// forms in different contexts (e.g. renting their own apartment as themselves, but representing a
// company as a Chiriaș elsewhere).
export function SignUpScreen() {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // null = not yet answered — a role this consequential shouldn't have a silent default either.
  const [role, setRole] = useState<Role | null>(null);
  const [nume, setNume] = useState("");
  const [prenume, setPrenume] = useState("");

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore((state) => state.signIn);
  const setAvailableContexts = useContextStore((state) => state.setAvailableContexts);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const roleValid = role !== null;
  const numeValid = nume.trim().length > 0;
  const prenumeValid = prenume.trim().length > 0;
  const formValid = email.trim().length > 0 && passwordsMatch && roleValid && numeValid && prenumeValid;

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
      // Section 3.2 point 4 / 5.1 — seeds the header ContextToggle with the role just picked; see
      // contextStore.ts for why this is a session-only guess, not real membership data.
      if (role) setAvailableContexts([role]);

      // TODO(backend): no API exists yet — this is where the call goes once it does. OWNER:
      // `users(name)` + create `accounts(name)` (name defaults to the person's own name — just a
      // workspace label, Section 3.1) + `account_membership(role=OWNER)` — zero `legal_entities` yet,
      // the first one gets created the first time it's needed (Section 4.3). TENANT: just a `users`
      // row for now — they have no account/tenancy yet, that's created later when they add a tenancy
      // via the association code from inside the app (Section 4.4, also not built yet). For now
      // nothing filled in here is persisted past this log.
      const name = `${prenume.trim()} ${nume.trim()}`.trim();
      console.log("Pending user creation payload:", { role, name });
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

      <Text style={styles.sectionLabel}>Date personale</Text>
      <TextInput style={styles.input} placeholder="Nume" value={nume} onChangeText={setNume} />
      <TextInput style={styles.input} placeholder="Prenume" value={prenume} onChangeText={setPrenume} />

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
});
