import { create } from "zustand";

import { legalEntitiesApi, propertiesApi, unitsApi } from "../api/properties";
import type { ApiLegalEntity, ApiProperty, ApiUnit } from "../api/properties";
import { useAccountStore } from "./accountStore";

export type LegalForm = "PF" | "PFA" | "II" | "IF" | "SRL" | "SA";
export type LegalEntityType = "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY";
export type UnitType = "APARTMENT" | "HOUSE" | "RETAIL" | "WAREHOUSE" | "OFFICE";
export type UtilityType =
  | "COLD_WATER"
  | "HOT_WATER"
  | "GAS"
  | "ELECTRICITY"
  | "INTERNET"
  | "TRASH"
  | "MAINTENANCE"
  | "OTHER";

export type LegalEntity = {
  id: string;
  legalForm: LegalForm;
  type: LegalEntityType;
  name: string;
  // Business forms only (PFA/II/IF/SRL/SA) — collected immediately at creation (Section 4.3), since
  // a CUI-bearing entity has no purpose without its CUI. Persoană Fizică leaves these unset — its
  // CNP is deferred to the entity's first tenancy (Section 4.4, not built yet), same
  // data-minimization rationale as before, just scoped to the legal entity instead of the account.
  cuiCnp?: string;
  vatPayer?: boolean;
  invoiceSeries?: string;
};

export type LegalEntityInput = {
  legalForm: LegalForm;
  name: string;
  cuiCnp?: string;
  vatPayer?: boolean;
  invoiceSeries?: string;
};

export type PropertyAddress = {
  streetNumber: string;
  street: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  county: string;
};

// Just the building — an address container. No type, no legal entity: a single property can hold
// units of different types and different legal entities (Section 3.1).
export type Property = PropertyAddress & {
  id: string;
};

// One row per utility type on a unit — simplified mock version of the real `unit_utilities` table
// (SPEC.md §3.1), which also has a `tariffBasis` (index/fixed/quota/per-person) and separate
// unitPrice/fixedAmount/quotaPercentage fields depending on that basis. Here it's just a flat
// enabled toggle + a single monthly price (always RON, same as the real schema has no currency on
// this table) — enough for the mobile mock's toggle+price UI without building the full 4-way tariff
// picker yet. **Still entirely client-side** — no unit_utilities endpoint exists in
// services/properties yet, so this doesn't survive a fresh app launch even though legal
// entities/properties/units themselves now do (Section 4.3's API).
export type UnitUtility = {
  type: UtilityType;
  enabled: boolean;
  price: number;
};

// The actual rentable/invoiceable thing — carries its own type and legal entity, not the building.
export type Unit = {
  id: string;
  propertyId: string;
  legalEntityId: string;
  label: string;
  type: UnitType;
  // Client-side only (Section 4.4 not wired to a backend yet) — true the moment the owner creates a
  // (mocked) tenancy on this unit, independent of the real `active`/API-backed fields below.
  hasActiveTenancy: boolean;
  // Deactivating hides this unit from new-tenancy eligibility without deleting it — distinct from
  // an actual delete (Section 4.3). Lives on the unit, not the property: a building can have some
  // units still rentable and others taken off the market, so "active" only makes sense per-unit.
  active: boolean;
  // Always all 8 UtilityType entries, most `enabled: false` by default — set from the unit form's
  // toggle list (Section 4.3), shown read-only to the tenant on their own tenancy tile (Section 4.4).
  utilities: UnitUtility[];
};

export type RentCurrency = "EUR" | "RON";

// Section 4.4 — a tenancy created on a unit, persisted so the association_code stays accessible
// (not just shown once at creation time and thrown away). Excludes visually ambiguous characters
// (0/O, 1/I) in the code — it gets read off one screen and typed into another by hand. **Still
// entirely mocked/client-side — no tenancies backend exists yet, only legal entities/properties/
// units (Section 4.3) are real as of this session.**
export type Tenancy = {
  id: string;
  unitId: string;
  startDate: string;
  rentAmount: number;
  rentCurrency: RentCurrency;
  associationCode: string;
  // Flips to true once the tenant enters this code in their own dashboard (TenantTenanciesScreen,
  // §4.4) — distinct from the unit's own Închiriată/Liberă flag (whether a tenancy contract exists
  // at all): a unit can be "Închiriată" with its tenancy still "Neasociat" if the owner created the
  // tenancy but the tenant hasn't claimed it yet.
  associated: boolean;
};

const ASSOCIATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAssociationCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ASSOCIATION_CODE_ALPHABET[Math.floor(Math.random() * ASSOCIATION_CODE_ALPHABET.length)];
  }
  return code;
}

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  APARTMENT: "Apartament",
  HOUSE: "Casă",
  RETAIL: "Spațiu comercial",
  WAREHOUSE: "Hală / Depozit",
  OFFICE: "Birou",
};

// Shared between Portofoliu's unit tiles and Închirieri's unit/tenancy tiles (§4.3/§4.4) so both
// show the same sub-type label instead of each keeping its own copy of this map.
export function unitTypeLabel(type: UnitType): string {
  return UNIT_TYPE_LABELS[type];
}

const UTILITY_TYPES: UtilityType[] = [
  "COLD_WATER",
  "HOT_WATER",
  "GAS",
  "ELECTRICITY",
  "INTERNET",
  "TRASH",
  "MAINTENANCE",
  "OTHER",
];

const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  COLD_WATER: "Apă rece",
  HOT_WATER: "Apă caldă",
  GAS: "Gaz",
  ELECTRICITY: "Curent",
  INTERNET: "Internet",
  TRASH: "Salubritate",
  MAINTENANCE: "Întreținere",
  OTHER: "Altele",
};

export function utilityTypeLabel(type: UtilityType): string {
  return UTILITY_TYPE_LABELS[type];
}

// Metered utilities (water/gas/electricity) are priced per unit of consumption, not a flat monthly
// fee like internet/salubritate/întreținere — shown next to the price field/tile so "50" reads as
// "50 RON/m³" or "50 RON/kWh", not an ambiguous flat amount.
const UTILITY_UNIT_LABELS: Record<UtilityType, string> = {
  COLD_WATER: "RON/m³",
  HOT_WATER: "RON/m³",
  GAS: "RON/m³",
  ELECTRICITY: "RON/kWh",
  INTERNET: "RON/lună",
  TRASH: "RON/lună",
  MAINTENANCE: "RON/lună",
  OTHER: "RON/lună",
};

export function utilityUnitLabel(type: UtilityType): string {
  return UTILITY_UNIT_LABELS[type];
}

// Starting point for a brand-new unit's utility list (Section 4.3's unit form) — every type present,
// all off by default, price 0 until toggled on and given a price.
export function defaultUnitUtilities(): UnitUtility[] {
  return UTILITY_TYPES.map((type) => ({ type, enabled: false, price: 0 }));
}

export function legalEntityTypeFor(legalForm: LegalForm): LegalEntityType {
  if (legalForm === "PF") return "UNREGISTERED_INDIVIDUAL";
  // PFA, II, IF — the three sibling forms under OUG 44/2008, none with legal personality, all
  // CUI-bearing and taxed the same way; legal_entities.type doesn't distinguish them (Section 3.1).
  if (legalForm === "PFA" || legalForm === "II" || legalForm === "IF") return "REGISTERED_INDIVIDUAL";
  return "REGISTERED_COMPANY"; // SRL and SA — legal_entities.type doesn't distinguish them either
}

// The real `legal_entities` table only stores the derived `type`, not the specific `legalForm` that
// produced it (Section 3.1 — intentional, since e.g. PFA/II/IF "don't distinguish" for any real
// purpose). So a legal entity fetched back from the API can't recover its *exact* original
// `legalForm` — this picks a representative one per type just so the mobile form's picker has
// something valid pre-selected when editing. Saving without changing it round-trips fine (same
// `type`); it just can't tell PFA from II from IF (or SRL from SA) after a fetch.
const REPRESENTATIVE_LEGAL_FORM: Record<LegalEntityType, LegalForm> = {
  UNREGISTERED_INDIVIDUAL: "PF",
  REGISTERED_INDIVIDUAL: "PFA",
  REGISTERED_COMPANY: "SRL",
};

// Single-line form — for contexts that need a plain string (Alert confirm messages), not the
// two-line tile display below.
export function formatPropertyAddress(address: PropertyAddress): string {
  const line1 = `${address.street} ${address.streetNumber}`;
  const parts = [line1, address.addressLine2, `${address.city}, ${address.county}`].filter(Boolean);
  return parts.join(", ");
}

// Two-line tile display (Portofoliu's property tiles, Închirieri's property-group headers) —
// "Strada X, Număr Y[, linie opțională]" then "Județ / Oraș" underneath.
export function formatPropertyStreetLine(address: PropertyAddress): string {
  const parts = [`Strada ${address.street}, Număr ${address.streetNumber}`, address.addressLine2].filter(Boolean);
  return parts.join(", ");
}

export function formatPropertyLocalityLine(address: PropertyAddress): string {
  return `${address.county} / ${address.city}`;
}

function fromApiLegalEntity(api: ApiLegalEntity): LegalEntity {
  return {
    id: api.id,
    legalForm: REPRESENTATIVE_LEGAL_FORM[api.type],
    type: api.type,
    name: api.legalName ?? "",
    cuiCnp: api.cuiCnp ?? undefined,
    vatPayer: api.vatPayer,
    invoiceSeries: api.invoiceSeries ?? undefined,
  };
}

function fromApiProperty(api: ApiProperty): Property {
  return {
    id: api.id,
    streetNumber: api.streetNumber,
    street: api.street,
    addressLine2: api.addressLine2 ?? undefined,
    postalCode: api.postalCode,
    city: api.city,
    county: api.county,
  };
}

// Preserves the client-only fields (hasActiveTenancy, utilities) across a re-fetch by looking up
// the unit that was already in state, instead of resetting them to defaults every time.
function fromApiUnit(api: ApiUnit, existing: Unit | undefined): Unit {
  return {
    id: api.id,
    propertyId: api.propertyId,
    legalEntityId: api.legalEntityId,
    label: api.label,
    type: api.type,
    active: api.active,
    hasActiveTenancy: existing?.hasActiveTenancy ?? false,
    utilities: existing?.utilities ?? defaultUnitUtilities(),
  };
}

function currentAccountId(): string {
  const accountId = useAccountStore.getState().activeAccountId;
  if (!accountId) throw new Error("Niciun cont încărcat încă");
  return accountId;
}

type PortfolioState = {
  legalEntities: LegalEntity[];
  properties: Property[];
  units: Unit[];
  loading: boolean;
  error: string | null;
  fetchPortfolio: () => Promise<void>;
  addLegalEntity: (input: LegalEntityInput) => Promise<LegalEntity>;
  updateLegalEntity: (id: string, input: LegalEntityInput) => Promise<void>;
  deleteLegalEntity: (id: string) => Promise<void>;
  addProperty: (address: PropertyAddress) => Promise<Property>;
  updateProperty: (id: string, address: PropertyAddress) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  addUnit: (
    propertyId: string,
    legalEntityId: string,
    label: string,
    type: UnitType,
    utilities: UnitUtility[],
  ) => Promise<Unit>;
  updateUnit: (
    id: string,
    legalEntityId: string,
    label: string,
    type: UnitType,
    utilities: UnitUtility[],
  ) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  setUnitActive: (id: string, active: boolean) => Promise<void>;
  tenancies: Tenancy[];
  addTenancy: (unitId: string, startDate: string, rentAmount: number, rentCurrency: RentCurrency) => Tenancy;
  updateTenancy: (id: string, startDate: string, rentAmount: number, rentCurrency: RentCurrency) => void;
  deleteTenancy: (id: string) => void;
  associateTenancyByCode: (code: string) => "associated" | "already_associated" | "not_found";
};

// Section 4.3 — the owner's fiscal identities (legal_entities) and physical inventory (properties →
// units), independent of who's renting what. Legal entities/properties/units are now **real**,
// backed by services/properties (Section 6) — every add/update/delete/fetch below calls the live
// API, scoped to `useAccountStore`'s `activeAccountId`. Tenancies (Section 4.4) are **still entirely
// mocked/client-side** — no backend for those yet, so `units.hasActiveTenancy` and each unit's
// `utilities` stay local-only, preserved across re-fetches by `fromApiUnit` rather than being part
// of what's persisted server-side.
export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  legalEntities: [],
  properties: [],
  units: [],
  loading: false,
  error: null,

  fetchPortfolio: async () => {
    set({ loading: true, error: null });
    try {
      const accountId = currentAccountId();
      const [legalEntities, properties, units] = await Promise.all([
        legalEntitiesApi.list(accountId),
        propertiesApi.list(accountId),
        unitsApi.list(accountId),
      ]);
      const existingUnits = get().units;
      set({
        legalEntities: legalEntities.map(fromApiLegalEntity),
        properties: properties.map(fromApiProperty),
        units: units.map((unit) => fromApiUnit(unit, existingUnits.find((u) => u.id === unit.id))),
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Nu am putut încărca portofoliul" });
    }
  },

  addLegalEntity: async (input) => {
    const created = await legalEntitiesApi.create(currentAccountId(), input);
    const legalEntity = fromApiLegalEntity(created);
    set((state) => ({ legalEntities: [...state.legalEntities, legalEntity] }));
    return legalEntity;
  },
  updateLegalEntity: async (id, input) => {
    const updated = await legalEntitiesApi.update(currentAccountId(), id, input);
    const legalEntity = fromApiLegalEntity(updated);
    set((state) => ({
      legalEntities: state.legalEntities.map((entity) => (entity.id === id ? legalEntity : entity)),
    }));
  },
  deleteLegalEntity: async (id) => {
    await legalEntitiesApi.remove(currentAccountId(), id);
    set((state) => ({
      legalEntities: state.legalEntities.filter((entity) => entity.id !== id),
    }));
  },

  addProperty: async (address) => {
    const created = await propertiesApi.create(currentAccountId(), address);
    const property = fromApiProperty(created);
    set((state) => ({ properties: [...state.properties, property] }));
    return property;
  },
  updateProperty: async (id, address) => {
    const updated = await propertiesApi.update(currentAccountId(), id, address);
    const property = fromApiProperty(updated);
    set((state) => ({
      properties: state.properties.map((existing) => (existing.id === id ? property : existing)),
    }));
  },
  deleteProperty: async (id) => {
    await propertiesApi.remove(currentAccountId(), id);
    set((state) => ({
      properties: state.properties.filter((property) => property.id !== id),
      units: state.units.filter((unit) => unit.propertyId !== id),
    }));
  },

  addUnit: async (propertyId, legalEntityId, label, type, utilities) => {
    const created = await unitsApi.create(currentAccountId(), propertyId, { legalEntityId, label, type });
    const unit = fromApiUnit(created, undefined);
    unit.utilities = utilities;
    set((state) => ({ units: [...state.units, unit] }));
    return unit;
  },
  updateUnit: async (id, legalEntityId, label, type, utilities) => {
    const existing = get().units.find((unit) => unit.id === id);
    if (!existing) throw new Error("Unitatea nu mai există local");
    const updated = await unitsApi.update(currentAccountId(), existing.propertyId, id, {
      legalEntityId,
      label,
      type,
    });
    const unit = fromApiUnit(updated, existing);
    unit.utilities = utilities;
    set((state) => ({ units: state.units.map((u) => (u.id === id ? unit : u)) }));
  },
  deleteUnit: async (id) => {
    const existing = get().units.find((unit) => unit.id === id);
    if (!existing) return;
    await unitsApi.remove(currentAccountId(), existing.propertyId, id);
    set((state) => ({ units: state.units.filter((unit) => unit.id !== id) }));
  },
  setUnitActive: async (id, active) => {
    const existing = get().units.find((unit) => unit.id === id);
    if (!existing) return;
    const updated = await unitsApi.update(currentAccountId(), existing.propertyId, id, { active });
    const unit = fromApiUnit(updated, existing);
    set((state) => ({ units: state.units.map((u) => (u.id === id ? unit : u)) }));
  },

  tenancies: [],
  addTenancy: (unitId, startDate, rentAmount, rentCurrency) => {
    const tenancy: Tenancy = {
      id: crypto.randomUUID(),
      unitId,
      startDate,
      rentAmount,
      rentCurrency,
      associationCode: generateAssociationCode(),
      associated: false,
    };
    set((state) => ({
      tenancies: [...state.tenancies, tenancy],
      units: state.units.map((unit) =>
        unit.id === unitId ? { ...unit, hasActiveTenancy: true } : unit,
      ),
    }));
    return tenancy;
  },
  updateTenancy: (id, startDate, rentAmount, rentCurrency) => {
    set((state) => ({
      tenancies: state.tenancies.map((tenancy) =>
        tenancy.id === id ? { ...tenancy, startDate, rentAmount, rentCurrency } : tenancy,
      ),
    }));
  },
  deleteTenancy: (id) => {
    const tenancy = get().tenancies.find((t) => t.id === id);
    set((state) => ({
      tenancies: state.tenancies.filter((t) => t.id !== id),
      units: tenancy
        ? state.units.map((unit) =>
            unit.id === tenancy.unitId ? { ...unit, hasActiveTenancy: false } : unit,
          )
        : state.units,
    }));
  },
  // Section 4.4, tenant side — resolves the code entered in TenantTenanciesScreen against the same
  // shared store the owner side writes to (no backend needed for this loop to actually work in the
  // mock, since both contexts run in the same client app). Case/whitespace-insensitive, matching how
  // the code is displayed (uppercase alphabet, Section context above).
  associateTenancyByCode: (code) => {
    const normalized = code.trim().toUpperCase();
    const tenancy = get().tenancies.find((t) => t.associationCode === normalized);
    if (!tenancy) return "not_found";
    if (tenancy.associated) return "already_associated";
    set((state) => ({
      tenancies: state.tenancies.map((t) => (t.id === tenancy.id ? { ...t, associated: true } : t)),
    }));
    return "associated";
  },
}));
