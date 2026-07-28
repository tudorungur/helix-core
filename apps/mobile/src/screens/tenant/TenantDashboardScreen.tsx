import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FormScreen } from "../../components/FormScreen";
import { formStyles as styles } from "../../components/formStyles";
import { formatPropertyStreetLine, usePortfolioStore } from "../../context/portfolioStore";

// Section 5.1, "Acasă" tab (added 2026-07-28) — symmetric with OwnerDashboardScreen: landing screen
// instead of a direct landing on Chiriile mele, and a home for Citire index/Facturi/Mentenanță now
// that they no longer have their own (permanently-empty) tabs — see TenantTabs.tsx's own comment.
// Read-only: no "+ Asociază chirie" trigger here, that stays on Chiriile mele.
export function TenantDashboardScreen() {
  const myTenancies = usePortfolioStore((state) => state.myTenancies);
  const myTenanciesLoading = usePortfolioStore((state) => state.myTenanciesLoading);
  const myTenanciesError = usePortfolioStore((state) => state.myTenanciesError);
  const fetchMyTenancies = usePortfolioStore((state) => state.fetchMyTenancies);

  // Dashboard is now the landing tab (Home tab index 0) — Chiriile mele's own fetch (its `useEffect`)
  // no longer fires until the user actually taps that tab, so this needs its own trigger too,
  // otherwise Acasă would show 0 chirii until the user happened to visit Chiriile mele first.
  useEffect(() => {
    fetchMyTenancies();
  }, [fetchMyTenancies]);

  return (
    <FormScreen contentContainerStyle={[styles.container, styles.containerCompactTop]} showBrand={false}>
      {myTenancies.length === 0 && myTenanciesLoading ? (
        <Text style={styles.hint}>Se încarcă...</Text>
      ) : myTenancies.length === 0 && myTenanciesError ? (
        <Text style={styles.error}>{myTenanciesError}</Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Rezumat</Text>
          <View style={localStyles.statCard}>
            <Text style={localStyles.statValue}>{myTenancies.length}</Text>
            <Text style={localStyles.statLabel}>
              {myTenancies.length === 1 ? "chirie activă" : "chirii active"}
            </Text>
          </View>

          {myTenancies.length > 0 ? (
            <View style={localStyles.tenancyList}>
              {myTenancies.map((tenancy, index) => (
                <View
                  key={tenancy.id}
                  style={[localStyles.tenancyRow, index > 0 && localStyles.tenancyRowDivider]}
                >
                  <Text style={localStyles.tenancyAddress}>{formatPropertyStreetLine(tenancy.property)}</Text>
                  <Text style={localStyles.tenancyCaption}>Proprietar: {tenancy.legalEntity.name}</Text>
                  <Text style={localStyles.tenancyCaption}>
                    Chirie: {tenancy.rentAmount} {tenancy.rentCurrency}/lună
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>În curând</Text>
          <View style={localStyles.comingSoonList}>
            <View style={localStyles.comingSoonRow}>
              <Text style={localStyles.comingSoonText}>Citire index</Text>
            </View>
            <View style={[localStyles.comingSoonRow, localStyles.comingSoonRowDivider]}>
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
  statCard: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  tenancyList: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
    backgroundColor: "#fff",
  },
  tenancyRow: { padding: 12, gap: 2 },
  tenancyRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  tenancyAddress: { fontSize: 15, fontWeight: "600" },
  tenancyCaption: { fontSize: 12, color: "#8e8e93" },
  comingSoonList: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  comingSoonRow: { padding: 12 },
  comingSoonRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ccc" },
  comingSoonText: { fontSize: 15, color: "#8e8e93" },
});
