import { StyleSheet, Text, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { usePortfolioStore } from "../../context/portfolioStore";

// Section 5.1, "Acasă" tab (added 2026-07-28) — the landing screen, replacing a direct landing on
// Portofoliu. Two things it's built to solve at once: a genuine "at a glance" view (previously
// nonexistent — every real screen was a list+form, nothing summarized across them) and a home for
// Facturi/Mentenanță now that they no longer have their own (permanently-empty) tabs — see
// OwnerTabs.tsx's own comment for why those were pulled. Read-only: no add-triggers here, those
// stay in Portofoliu/Închirieri so nothing is duplicated.
export function OwnerDashboardScreen() {
  const units = usePortfolioStore((state) => state.units);
  const tenancies = usePortfolioStore((state) => state.tenancies);
  const legalEntities = usePortfolioStore((state) => state.legalEntities);
  const loading = usePortfolioStore((state) => state.loading);
  const error = usePortfolioStore((state) => state.error);

  const rentedUnits = units.filter((unit) => unit.hasActiveTenancy).length;
  const freeUnits = units.length - rentedUnits;
  const activeTenancies = tenancies.filter((tenancy) => tenancy.status === "ACTIVE").length;
  const pendingTenancies = tenancies.filter((tenancy) => tenancy.status === "PENDING_TENANT").length;

  // Same relevance/resolved logic as OwnerTenanciesScreen's own tile (CNP for the withholding
  // statement, C168 registration) — counted here across every tenancy at once instead of requiring
  // a scroll through Închirieri to spot which ones still need attention.
  const unresolvedAlerts = tenancies.reduce((count, tenancy) => {
    const unit = units.find((u) => u.id === tenancy.unitId);
    const legalEntity = unit ? legalEntities.find((entity) => entity.id === unit.legalEntityId) : undefined;
    const cnpRelevant = tenancy.contractType === "C2B_WITHHOLDING";
    const cnpResolved = !!legalEntity?.cuiCnp;
    const c168Relevant = tenancy.contractType === "C2B_WITHHOLDING" || tenancy.contractType === "UNREGISTERED_C2C";
    const c168Resolved = tenancy.anafC168Registered;
    return count + (cnpRelevant && !cnpResolved ? 1 : 0) + (c168Relevant && !c168Resolved ? 1 : 0);
  }, 0);

  return (
    <FormScreen contentContainerStyle={[styles.container, styles.containerCompactTop]} showBrand={false}>
      {units.length === 0 && loading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : units.length === 0 && error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Rezumat</Text>
          <View style={localStyles.statsRow}>
            <View style={localStyles.statCard}>
              <Text style={localStyles.statValue}>{freeUnits}</Text>
              <Text style={localStyles.statLabel}>unități libere</Text>
            </View>
            <View style={localStyles.statCard}>
              <Text style={localStyles.statValue}>{rentedUnits}</Text>
              <Text style={localStyles.statLabel}>unități închiriate</Text>
            </View>
          </View>
          <View style={localStyles.statsRow}>
            <View style={localStyles.statCard}>
              <Text style={localStyles.statValue}>{activeTenancies}</Text>
              <Text style={localStyles.statLabel}>chirii active</Text>
            </View>
            <View style={localStyles.statCard}>
              <Text style={localStyles.statValue}>{pendingTenancies}</Text>
              <Text style={localStyles.statLabel}>în așteptare de asociere</Text>
            </View>
          </View>

          {unresolvedAlerts > 0 ? (
            <View style={localStyles.alertCard}>
              <Text style={localStyles.alertText}>
                ⚠️ {unresolvedAlerts} {unresolvedAlerts === 1 ? "alertă nerezolvată" : "alerte nerezolvate"} (CNP
                / C168) — vezi Închirieri pentru detalii.
              </Text>
            </View>
          ) : tenancies.length > 0 ? (
            <View style={localStyles.resolvedCard}>
              <Text style={localStyles.resolvedText}>✓ Nicio alertă de conformitate nerezolvată.</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>În curând</Text>
          <View style={localStyles.comingSoonList}>
            <View style={localStyles.comingSoonRow}>
              <Text style={localStyles.comingSoonText}>Facturi</Text>
            </View>
            <View style={[localStyles.comingSoonRow, localStyles.comingSoonRowDivider]}>
              <Text style={localStyles.comingSoonText}>Mentenanță</Text>
            </View>
          </View>
        </>
      )}
    </FormScreen>
  );
}

const localStyles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12, color: "#8e8e93", marginTop: 2, textAlign: "center" },
  alertCard: {
    borderWidth: 1,
    borderColor: "#f0c48a",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    backgroundColor: "#fff7ec",
  },
  alertText: { fontSize: 13, color: "#c77700", fontWeight: "600" },
  resolvedCard: {
    borderWidth: 1,
    borderColor: "#a8dcc3",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    backgroundColor: "#f0faf5",
  },
  resolvedText: { fontSize: 13, color: "#1a9e5c", fontWeight: "600" },
  comingSoonList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  comingSoonRow: { padding: 12 },
  comingSoonRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  comingSoonText: { fontSize: 15, color: "#8e8e93" },
});
