import { create } from "zustand";

export type LegalForm = "PF" | "PFA" | "II" | "IF" | "SRL" | "SA";
export type LegalEntityType = "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY";
export type UnitType = "APARTMENT" | "HOUSE" | "RETAIL" | "WAREHOUSE" | "OFFICE";

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
  // Deactivating hides this property (and its units) from new-tenancy eligibility without deleting
  // it — distinct from an actual delete (Section 4.3).
  active: boolean;
};

// The actual rentable/invoiceable thing — carries its own type and legal entity, not the building.
export type Unit = {
  id: string;
  propertyId: string;
  legalEntityId: string;
  label: string;
  type: UnitType;
  hasActiveTenancy: boolean;
};

export type RentCurrency = "EUR" | "RON";

// Section 4.4 — a tenancy created on a unit, persisted so the association_code stays accessible
// (not just shown once at creation time and thrown away). Excludes visually ambiguous characters
// (0/O, 1/I) in the code — it gets read off one screen and typed into another by hand.
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

export function legalEntityTypeFor(legalForm: LegalForm): LegalEntityType {
  if (legalForm === "PF") return "UNREGISTERED_INDIVIDUAL";
  // PFA, II, IF — the three sibling forms under OUG 44/2008, none with legal personality, all
  // CUI-bearing and taxed the same way; legal_entities.type doesn't distinguish them (Section 3.1).
  if (legalForm === "PFA" || legalForm === "II" || legalForm === "IF") return "REGISTERED_INDIVIDUAL";
  return "REGISTERED_COMPANY"; // SRL and SA — legal_entities.type doesn't distinguish them either
}

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

type PortfolioState = {
  legalEntities: LegalEntity[];
  properties: Property[];
  units: Unit[];
  addLegalEntity: (input: LegalEntityInput) => LegalEntity;
  updateLegalEntity: (id: string, input: LegalEntityInput) => void;
  deleteLegalEntity: (id: string) => void;
  addProperty: (address: PropertyAddress) => Property;
  updateProperty: (id: string, address: PropertyAddress) => void;
  deleteProperty: (id: string) => void;
  setPropertyActive: (id: string, active: boolean) => void;
  addUnit: (propertyId: string, legalEntityId: string, label: string, type: UnitType) => Unit;
  updateUnit: (id: string, legalEntityId: string, label: string, type: UnitType) => void;
  deleteUnit: (id: string) => void;
  tenancies: Tenancy[];
  addTenancy: (unitId: string, startDate: string, rentAmount: number, rentCurrency: RentCurrency) => Tenancy;
  updateTenancy: (id: string, startDate: string, rentAmount: number, rentCurrency: RentCurrency) => void;
  deleteTenancy: (id: string) => void;
  associateTenancyByCode: (code: string) => "associated" | "already_associated" | "not_found";
};

let nextId = 1;
const generateId = () => String(nextId++);

// Section 4.3 — the owner's fiscal identities (legal_entities) and physical inventory (properties →
// units), independent of who's renting what. In-memory only, mocked pending a backend (same pattern
// as contextStore.ts) — nothing here survives a fresh app launch. Section 4.4's Tenancies flow reads
// `units` and picks one with `hasActiveTenancy: false` on an **active** property rather than
// creating a unit inline; `addTenancy` both persists the `Tenancy` (so its association_code stays
// accessible, not just shown once) and flips that unit out of the "available" pool in the same
// update. A single account can hold multiple `legalEntities` — each `unit` (not property) picks
// exactly one, which decides that unit's e-Factura eligibility (Section 1's note on the label being
// per-unit, not per-property or per-account).
export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  legalEntities: [],
  properties: [],
  units: [],
  addLegalEntity: ({ legalForm, name, cuiCnp, vatPayer, invoiceSeries }) => {
    const legalEntity: LegalEntity = {
      id: generateId(),
      legalForm,
      type: legalEntityTypeFor(legalForm),
      name,
      cuiCnp,
      vatPayer,
      invoiceSeries,
    };
    set((state) => ({ legalEntities: [...state.legalEntities, legalEntity] }));
    return legalEntity;
  },
  updateLegalEntity: (id, { legalForm, name, cuiCnp, vatPayer, invoiceSeries }) => {
    set((state) => ({
      legalEntities: state.legalEntities.map((entity) =>
        entity.id === id
          ? { ...entity, legalForm, type: legalEntityTypeFor(legalForm), name, cuiCnp, vatPayer, invoiceSeries }
          : entity,
      ),
    }));
  },
  deleteLegalEntity: (id) => {
    set((state) => ({
      legalEntities: state.legalEntities.filter((entity) => entity.id !== id),
    }));
  },
  addProperty: (address) => {
    const property: Property = { id: generateId(), active: true, ...address };
    set((state) => ({ properties: [...state.properties, property] }));
    return property;
  },
  updateProperty: (id, address) => {
    set((state) => ({
      properties: state.properties.map((property) =>
        property.id === id ? { ...property, ...address } : property,
      ),
    }));
  },
  deleteProperty: (id) => {
    set((state) => ({
      properties: state.properties.filter((property) => property.id !== id),
      units: state.units.filter((unit) => unit.propertyId !== id),
    }));
  },
  setPropertyActive: (id, active) => {
    set((state) => ({
      properties: state.properties.map((property) =>
        property.id === id ? { ...property, active } : property,
      ),
    }));
  },
  addUnit: (propertyId, legalEntityId, label, type) => {
    const unit: Unit = { id: generateId(), propertyId, legalEntityId, label, type, hasActiveTenancy: false };
    set((state) => ({ units: [...state.units, unit] }));
    return unit;
  },
  updateUnit: (id, legalEntityId, label, type) => {
    set((state) => ({
      units: state.units.map((unit) =>
        unit.id === id ? { ...unit, legalEntityId, label, type } : unit,
      ),
    }));
  },
  deleteUnit: (id) => {
    set((state) => ({ units: state.units.filter((unit) => unit.id !== id) }));
  },
  tenancies: [],
  addTenancy: (unitId, startDate, rentAmount, rentCurrency) => {
    const tenancy: Tenancy = {
      id: generateId(),
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
