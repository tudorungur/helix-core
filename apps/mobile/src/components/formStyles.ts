import { StyleSheet } from "react-native";

// Shared visual language for every form screen (auth + in-app) — input/button/choice styling was
// duplicated near-identically across SignIn/SignUp before this existed; new form screens should
// use this instead of redefining the same styles a third and fourth time.
export const formStyles = StyleSheet.create({
  container: { padding: 24, paddingTop: 32, gap: 12 },
  // Overrides container's paddingTop for screens mounted directly under AppStack's fixed header
  // (ContextTitle/SignOutButton chips) — Owner tab roots (Portofoliu, Setări, Închirieri). 32 was
  // sized for auth screens with no header above them; right under the fixed header it read as too
  // much empty space before the first section title.
  containerCompactTop: { paddingTop: 12 },
  // Same as containerCompactTop but for screens that also pass FormScreen a `header` — the header
  // already carries its own top padding, so the scrollable content underneath doesn't need more.
  containerHeaderTop: { paddingTop: 4 },
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
  // A centered, delimited "+ Adaugă X" trigger — its own bordered section, not a plain inline text
  // link. Used wherever an "add" action needs to read as a distinct block (Portofoliu's Adaugă
  // proprietate, Setări's Adaugă entitate legală).
  sectionTrigger: {
    borderWidth: 1,
    borderColor: "#1a73e8",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  sectionTriggerText: { color: "#1a73e8", fontWeight: "600" },
  // Greyed-out variant of sectionTrigger — still tappable (e.g. Închirieri's "+ Adaugă chirie" when
  // there's no free unit yet, which navigates to Portofoliu instead of opening the form), just
  // visually reads as blocked rather than the normal blue "ready to use" state.
  sectionTriggerDisabled: { borderColor: "#c7c7cc" },
  sectionTriggerTextDisabled: { color: "#8e8e93" },
  // Shared shape for the two nav-bar chips (ContextTitle's Proprietar/Chiriaș switcher,
  // SignOutButton's Delogare) — same borderRadius as sectionTrigger above, so every highlighted
  // "pill" in the app (add-triggers, nav chips) reads as one consistent, subtle style instead of
  // the nav chips' old fully-rounded (16px) capsule look. Fixed `height` (not paddingVertical) so
  // both chips are the same height regardless of content — ContextTitle's larger chevron glyph has
  // a taller intrinsic line height than SignOutButton's plain label text, so vertical padding alone
  // left them visibly different heights; a fixed height + centered content makes both identical.
  // Each screen still supplies its own background/text color.
  navChip: { borderRadius: 8, height: 32, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  navChipText: { fontSize: 14, fontWeight: "600" },
});
