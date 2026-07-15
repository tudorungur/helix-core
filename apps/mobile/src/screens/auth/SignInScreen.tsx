import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAuthStore } from "../../auth/authStore";
import { FormScreen } from "../../components/FormScreen";
import type { AuthStackParamList } from "../../navigation/AuthStack";

type Props = NativeStackScreenProps<AuthStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const status = useAuthStore((state) => state.status);

  return status === "newPasswordRequired" ? <NewPasswordForm /> : <SignInForm navigation={navigation} />;
}

function SignInForm({ navigation }: Pick<Props, "navigation">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await signIn(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen contentContainerStyle={styles.container}>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Intră în cont</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("SignUp")} hitSlop={8}>
        <Text style={styles.link}>Nu ai cont? Înregistrează-te</Text>
      </TouchableOpacity>
    </FormScreen>
  );
}

// Shown after an admin-invited user signs in with their Cognito-issued temporary password
// (Section 5.1 invite flow) — Cognito requires a real password before it'll issue a session.
function NewPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const completeNewPassword = useAuthStore((state) => state.completeNewPassword);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await completeNewPassword(newPassword);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen contentContainerStyle={styles.container}>
      <Text style={styles.hint}>
        Este prima ta autentificare. Alege o parolă nouă (minimum 8 caractere, literă mare, literă mică și
        cifră).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Parolă nouă"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Setează parola</Text>}
      </TouchableOpacity>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "center", padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  button: { backgroundColor: "#1a73e8", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#d32f2f" },
  hint: { color: "#555", marginBottom: 4 },
  link: { color: "#1a73e8", textAlign: "center", marginTop: 8 },
});
