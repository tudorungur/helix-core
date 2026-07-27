import { create } from "zustand";

import { legalEntitiesApi, propertiesApi, unitsApi } from "../api/properties";
import type { ApiLegalEntity, ApiProperty, ApiUnit } from "../api/properties";
import { tenanciesApi } from "../api/tenancies";
import type { ApiClaimTenancyInput, ApiMyTenancy, ApiTenancy } from "../api/tenancies";
import { useAccountStore } from "./accountStore";

export type LegalForm = "PF" | "PFA" | "II" | "IF" | "SRL" | "SA";
export type LegalEntityType = "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY";
export type UnitType = "APARTMENT" | "HOUSE" | "RETAIL" | "WAREHOUSE" | "OFFICE";
// `HEATING` (added separately from `MAINTENANCE`) — relevant when a building has centralized
// district heating (termoficare/centrală de bloc) instead of individual apartment boilers: heat
// cost is a real, recurring, separately-billed line (usually split by repartitoare/m² by the
// homeowners' association), distinct from generic maintenance fees. With an individual gas boiler
// (centrală de apartament), there's no separate heating cost at all — it's absorbed into `GAS`.
// **Not metered by this app** (no reading wizard step for it, §4.5) — unlike gas/electricity/water,
// nobody photographs a meter for it; the amount is whatever the association announces that month.
// How the owner is meant to keep this number current month-to-month isn't resolved yet — the
// existing "set once when configuring the unit" flow (a single persisted price) doesn't fit a cost
// that genuinely varies every billing cycle; see the discussion this was added from.
export type UtilityType =
  | "COLD_WATER"
  | "HOT_WATER"
  | "GAS"
  | "ELECTRICITY"
  | "HEATING"
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
  // a CUI-bearing entity has no purpose without its CUI. Persoană Fizică's CNP is optional, entered
  // whenever it's actually needed (e.g. a C2B_WITHHOLDING tenancy's withholding statement) rather
  // than deferred behind a first-tenancy flow that doesn't exist.
  cuiCnp?: string;
  vatPayer?: boolean;
  invoiceSeries?: string;
};

export type LegalEntityInput = {
  legalForm: LegalForm;
  name: string;
  // `null` (not just omitted/undefined) explicitly clears a previously-set value on update — see
  // OwnerSettingsScreen.tsx's submitForm and api/properties.ts's ApiLegalEntityInput for why.
  cuiCnp?: string | null;
  vatPayer?: boolean;
  invoiceSeries?: string | null;
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
// (SPEC.md §3.1), which also has a `tariffBasis` (index/fixed/declared) and separate
// unitPrice/fixedAmount fields depending on that basis. Here it's just a flat enabled toggle + a
// single monthly price (always RON, same as the real schema has no currency on this table) —
// enough for the mobile mock's toggle+price UI without building the full tariff-basis picker yet.
// **Still entirely client-side** — no unit_utilities endpoint exists in services/properties yet, so
// this doesn't survive a fresh app launch even though legal entities/properties/units themselves
// now do (Section 4.3's API).
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
export type TenancyStatus = "PENDING_TENANT" | "ACTIVE";
export type ContractType = "REGISTERED_ANAF" | "C2B_WITHHOLDING" | "UNREGISTERED_C2C";
export type TenantType = "INDIVIDUAL" | "COMPANY";

// Section 4.4 — a tenancy created on a unit, backed by services/tenancies. Owner creates it
// (`status="PENDING_TENANT"`, `contractType`/`tenantType` both null — unknowable until a tenant
// claims the code); the tenant claiming it (phase 2, this session) fills in `tenantType` (+ company
// fields), the server derives `contractType`, flips `status` to `"ACTIVE"`, and clears
// `associationCode`. Nothing client-only left on this type anymore — `status` replaces the old
// mocked `associated` boolean now that the real claim flow exists.
export type Tenancy = {
  id: string;
  unitId: string;
  startDate: string;
  rentAmount: number;
  rentCurrency: RentCurrency;
  associationCode: string;
  status: TenancyStatus;
  contractType: ContractType | null;
  tenantType: TenantType | null;
  tenantCompanyName?: string;
  tenantCompanyCui?: string;
  // Owner-facing "who am I renting to" identity for an INDIVIDUAL tenant — only present on the
  // account-scoped `GET .../tenancies` list response (services/tenancies' `listTenancies`), not on
  // create/update/claim/confirmC168's bare-row responses. Null until claimed, or once tenantType
  // isn't INDIVIDUAL (COMPANY already has `tenantCompanyName` above).
  tenantIndividualName?: string;
  // Form C168 (rental contract registration with ANAF, Section 4.4/4.10) — mandatory to surface for
  // C2B_WITHHOLDING, optional for UNREGISTERED_C2C, not applicable to REGISTERED_ANAF. The app never
  // submits it, just tracks the owner's self-confirmation.
  anafC168Registered: boolean;
  anafC168RegistrationDate?: string;
};

// "Chiriile mele" (TenantTenanciesScreen) needs unit/property/legalEntity display info
// denormalized onto each tenancy — a real tenant has no `accountId` to separately fetch
// `units`/`properties`/`legalEntities` with (no account_membership at all, Section 3.2).
// `legalEntity.name` is the tenant-facing "who am I renting from" identity, the counterpart to
// `Tenancy.tenantIndividualName` above.
export type MyTenancy = Tenancy & {
  unit: { id: string; label: string; type: UnitType };
  property: Property;
  legalEntity: { id: string; name: string };
};

// The UI reads/writes dates as ZZ-LL-AAAA (Romanian convention, OwnerTenanciesScreen's own
// validation); the DB's `date` column (and services/tenancies' zod input) uses ISO YYYY-MM-DD.
// Converted only at this boundary — everything else in the mobile app keeps using the RO format.
function toIsoDate(roDate: string): string {
  const [day, month, year] = roDate.split("-");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
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
  "HEATING",
  "INTERNET",
  "TRASH",
  "MAINTENANCE",
  "OTHER",
];

const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  COLD_WATER: "Apă rece",
  HOT_WATER: "Apă caldă",
  GAS: "Gaze naturale",
  ELECTRICITY: "Energie electrică",
  HEATING: "Încălzire",
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
// "50 RON/m³" or "50 RON/kWh", not an ambiguous flat amount. `HEATING` is flat/monthly too, not
// metered by this app — see the note above `HEATING` in the UtilityType comment: there's no
// per-unit meter for it here, the owner types in whatever the association announces that month.
const UTILITY_UNIT_LABELS: Record<UtilityType, string> = {
  COLD_WATER: "RON/m³",
  HOT_WATER: "RON/m³",
  GAS: "RON/m³",
  ELECTRICITY: "RON/kWh",
  HEATING: "RON/lună",
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

function fromApiTenancy(api: ApiTenancy): Tenancy {
  return {
    id: api.id,
    unitId: api.unitId,
    startDate: fromIsoDate(api.startDate),
    rentAmount: Number(api.rentAmount),
    rentCurrency: api.rentCurrency,
    associationCode: api.associationCode ?? "",
    status: api.status as TenancyStatus,
    contractType: api.contractType,
    tenantType: api.tenantType,
    tenantCompanyName: api.tenantCompanyName ?? undefined,
    tenantCompanyCui: api.tenantCompanyCui ?? undefined,
    tenantIndividualName: api.tenantIndividualName ?? undefined,
    anafC168Registered: api.anafC168Registered,
    anafC168RegistrationDate: api.anafC168RegistrationDate ?? undefined,
  };
}

function fromApiMyTenancy(api: ApiMyTenancy): MyTenancy {
  return {
    ...fromApiTenancy(api),
    unit: { id: api.unit.id, label: api.unit.label, type: api.unit.type },
    property: {
      id: api.property.id,
      streetNumber: api.property.streetNumber,
      street: api.property.street,
      addressLine2: api.property.addressLine2 ?? undefined,
      postalCode: api.property.postalCode,
      city: api.property.city,
      county: api.property.county,
    },
    legalEntity: { id: api.legalEntity.id, name: api.legalEntity.name ?? "—" },
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
  addTenancy: (
    unitId: string,
    startDate: string,
    rentAmount: number,
    rentCurrency: RentCurrency,
  ) => Promise<Tenancy>;
  updateTenancy: (id: string, startDate: string, rentAmount: number, rentCurrency: RentCurrency) => Promise<void>;
  deleteTenancy: (id: string) => Promise<void>;
  confirmC168: (id: string) => Promise<void>;
  myTenancies: MyTenancy[];
  myTenanciesLoading: boolean;
  myTenanciesError: string | null;
  fetchMyTenancies: () => Promise<void>;
  claimTenancy: (input: ApiClaimTenancyInput) => Promise<Tenancy>;
};

// Section 4.3/4.4 — the owner's fiscal identities (legal_entities), physical inventory
// (properties → units), and tenancies (both phases: owner creates, tenant claims) are all **real**
// now, backed by services/properties/services/tenancies (Section 6) — every add/update/delete/fetch
// below calls the live API, scoped to `useAccountStore`'s `activeAccountId`. The one thing still
// client-only by deliberate scope decision, not oversight: each unit's `utilities` (no
// `unit_utilities` endpoint yet) — preserved across re-fetches (`fromApiUnit`) instead of being
// reset to defaults. `units.hasActiveTenancy` is derived from real fetched tenancy data inside
// `fetchPortfolio` below, and `tenancies` themselves carry no client-only fields anymore now that
// the tenant-claim flow is real (`fromApiTenancy` needs no `existing` merge).
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
      const [legalEntities, properties, units, tenancies] = await Promise.all([
        legalEntitiesApi.list(accountId),
        propertiesApi.list(accountId),
        unitsApi.list(accountId),
        tenanciesApi.list(accountId),
      ]);
      const existingUnits = get().units;
      const nextTenancies = tenancies.map(fromApiTenancy);
      // `hasActiveTenancy` is now derived from the real, just-fetched tenancies list (an open
      // tenancy on the unit), not merged from local state like `utilities` below — tenancies
      // (unlike utilities) are real server data as of this session, so this is the authoritative
      // signal, not a client-only guess to preserve.
      const unitIdsWithTenancy = new Set(nextTenancies.map((tenancy) => tenancy.unitId));
      set({
        legalEntities: legalEntities.map(fromApiLegalEntity),
        properties: properties.map(fromApiProperty),
        units: units.map((unit) => ({
          ...fromApiUnit(unit, existingUnits.find((u) => u.id === unit.id)),
          hasActiveTenancy: unitIdsWithTenancy.has(unit.id),
        })),
        tenancies: nextTenancies,
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
  addTenancy: async (unitId, startDate, rentAmount, rentCurrency) => {
    const created = await tenanciesApi.create(currentAccountId(), unitId, {
      startDate: toIsoDate(startDate),
      rentAmount,
      rentCurrency,
    });
    const tenancy = fromApiTenancy(created);
    set((state) => ({
      tenancies: [...state.tenancies, tenancy],
      units: state.units.map((unit) => (unit.id === unitId ? { ...unit, hasActiveTenancy: true } : unit)),
    }));
    return tenancy;
  },
  updateTenancy: async (id, startDate, rentAmount, rentCurrency) => {
    const updated = await tenanciesApi.update(currentAccountId(), id, {
      startDate: toIsoDate(startDate),
      rentAmount,
      rentCurrency,
    });
    const tenancy = fromApiTenancy(updated);
    set((state) => ({
      tenancies: state.tenancies.map((t) => (t.id === id ? tenancy : t)),
    }));
  },
  deleteTenancy: async (id) => {
    const tenancy = get().tenancies.find((t) => t.id === id);
    await tenanciesApi.remove(currentAccountId(), id);
    set((state) => ({
      tenancies: state.tenancies.filter((t) => t.id !== id),
      units: tenancy
        ? state.units.map((unit) =>
            unit.id === tenancy.unitId ? { ...unit, hasActiveTenancy: false } : unit,
          )
        : state.units,
    }));
  },
  confirmC168: async (id) => {
    const updated = await tenanciesApi.confirmC168(currentAccountId(), id);
    const tenancy = fromApiTenancy(updated);
    set((state) => ({
      tenancies: state.tenancies.map((t) => (t.id === id ? tenancy : t)),
    }));
  },

  // Section 4.4, phase 2 — the tenant side. A tenant has no `account_membership` at all (that's the
  // point), so this is its own state slice, not folded into `tenancies` above (which is
  // account-scoped, `fetchPortfolio`-driven, and meaningless for a user with no account).
  myTenancies: [],
  myTenanciesLoading: false,
  myTenanciesError: null,
  fetchMyTenancies: async () => {
    set({ myTenanciesLoading: true, myTenanciesError: null });
    try {
      const mine = await tenanciesApi.mine();
      set({ myTenancies: mine.map(fromApiMyTenancy), myTenanciesLoading: false });
    } catch (error) {
      set({
        myTenanciesLoading: false,
        myTenanciesError: error instanceof Error ? error.message : "Nu am putut încărca chiriile",
      });
    }
  },
  claimTenancy: async (input) => {
    const created = await tenanciesApi.claim(input);
    // Re-fetch rather than append locally — the claim response is a bare `Tenancy`, not denormalized
    // with unit/property info the way `myTenancies` needs (`fromApiMyTenancy`'s shape), so there's
    // nothing useful to merge in by hand here. **Not awaited on purpose**: the caller
    // (TenantTenanciesScreen) closes its form as soon as this action resolves — awaiting the refetch
    // here delayed that close until after `myTenanciesLoading` had already flipped true, so the form
    // briefly stayed open with "Se încarcă..." already showing underneath it. Letting the refetch run
    // in the background means the form closes immediately once the claim itself succeeds, and
    // "Se încarcă..." (if the refetch is still in flight) only ever appears after that.
    get().fetchMyTenancies();
    return fromApiTenancy(created);
  },
}));
