import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ToggleOption<T extends string> = { value: T; label: string };

type ToggleProps<T extends string> = {
  // Omit for a bare segmented control (e.g. embedded next to another field, like currency beside
  // the rent amount) — pass it to get a labelled row (e.g. "Tip unitate" / "Plătitor de TVA").
  label?: string;
  options: [ToggleOption<T>, ToggleOption<T>];
  value: T | null;
  onChange: (value: T) => void;
};

// Two-option segmented control — replaces the old side-by-side bordered boxes (formStyles'
// choiceRow/choiceOption) wherever a form only ever has exactly two mutually exclusive options
// (Locativ/Comercial, EUR/RON, Da/Nu): one merged track instead of two separate tap targets.
export function Toggle<T extends string>({ label, options, value, onChange }: ToggleProps<T>) {
  const track = (
    <View style={styles.track}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.value}
          style={[styles.segment, index > 0 && styles.segmentDivider, value === option.value && styles.segmentSelected]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextSelected]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!label) return track;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {track}
    </View>
  );
}

const styles = StyleSheet.create({
  // No marginTop of its own — every parent form already spaces its fields with a flex `gap`, so
  // this only needs to lay out label + track, not add another margin on top of that.
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: "#8e8e93", fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  track: { flexDirection: "row", borderWidth: 1, borderColor: "#1a73e8", borderRadius: 8, overflow: "hidden" },
  segment: { paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: "#1a73e8" },
  segmentSelected: { backgroundColor: "#1a73e8" },
  segmentText: { color: "#1a73e8", fontWeight: "600", fontSize: 13 },
  segmentTextSelected: { color: "#fff" },
});
