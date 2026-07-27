import { apiRequest } from "./client";
import type { ApiLegalEntity, ApiLegalEntityInput, ApiLegalEntityType, ApiUnitType } from "./properties";

export type ApiContractType = "REGISTERED_ANAF" | "C2B_WITHHOLDING" | "UNREGISTERED_C2C";

// Wire shape returned by services/tenancies. `rentAmount` comes back as a string — `rent_amount` is
// a Postgres `numeric` column, Drizzle's default representation for it. `contractType` is null
// until a tenant claims the association_code (Section 4.4 phase 2). `tenantLegalEntity` is the
// tenant's own identity for this tenancy — one of their own (`userId`-scoped) legal_entities, picked
// at claim time (2026-07-27 consolidation, replacing the earlier flat tenantType/tenantCompanyName/
// tenantCompanyCui/tenantIndividualName fields) — null until claimed.
export type ApiTenancy = {
  id: string;
  unitId: string;
  startDate: string;
  rentAmount: string;
  rentCurrency: "EUR" | "RON";
  associationCode: string | null;
  status: string;
  contractType: ApiContractType | null;
  anafC168Registered: boolean;
  anafC168RegistrationDate: string | null;
  tenantLegalEntity: { id: string; name: string | null; type: ApiLegalEntityType } | null;
};

// GET /tenancies/mine denormalizes unit/property/legalEntity fields — a real tenant has no
// accountId to separately fetch them with (no account_membership at all). `legalEntity.name` is
// the "who am I renting from" identity, the tenant-side counterpart to `tenantLegalEntity` above
// (always non-null here — this list only ever holds already-claimed tenancies).
export type ApiMyTenancy = Omit<ApiTenancy, "tenantLegalEntity"> & {
  unit: { id: string; label: string; type: ApiUnitType };
  property: {
    id: string;
    streetNumber: string;
    street: string;
    addressLine2: string | null;
    postalCode: string;
    city: string;
    county: string;
  };
  legalEntity: { id: string; name: string | null };
  tenantLegalEntity: { id: string; name: string | null; type: ApiLegalEntityType };
};

export type ApiTenancyInput = {
  startDate: string;
  rentAmount: number;
  rentCurrency: "EUR" | "RON";
};

export type ApiClaimTenancyInput = { associationCode: string; tenantLegalEntityId: string };

const base = (accountId: string) => `/accounts/${accountId}`;

export const tenanciesApi = {
  list: (accountId: string) => apiRequest<ApiTenancy[]>(`${base(accountId)}/tenancies`),
  create: (accountId: string, unitId: string, input: ApiTenancyInput) =>
    apiRequest<ApiTenancy>(`${base(accountId)}/units/${unitId}/tenancies`, { method: "POST", body: input }),
  update: (accountId: string, id: string, input: Partial<ApiTenancyInput>) =>
    apiRequest<ApiTenancy>(`${base(accountId)}/tenancies/${id}`, { method: "PATCH", body: input }),
  remove: (accountId: string, id: string) =>
    apiRequest<void>(`${base(accountId)}/tenancies/${id}`, { method: "DELETE" }),
  confirmC168: (accountId: string, id: string) =>
    apiRequest<ApiTenancy>(`${base(accountId)}/tenancies/${id}/c168`, { method: "PATCH" }),
  claim: (input: ApiClaimTenancyInput) => apiRequest<ApiTenancy>("/tenancies/claim", { method: "POST", body: input }),
  mine: () => apiRequest<ApiMyTenancy[]>("/tenancies/mine"),
};

// Tenant's own reusable identities (Section 4.4, 2026-07-27 consolidation) — `userId`-scoped
// counterpart to `legalEntitiesApi` (properties.ts's account-scoped ones), same wire shape.
export const legalEntitiesMineApi = {
  list: () => apiRequest<ApiLegalEntity[]>("/legal-entities/mine"),
  create: (input: ApiLegalEntityInput) =>
    apiRequest<ApiLegalEntity>("/legal-entities/mine", { method: "POST", body: input }),
  update: (id: string, input: Partial<ApiLegalEntityInput>) =>
    apiRequest<ApiLegalEntity>(`/legal-entities/mine/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => apiRequest<void>(`/legal-entities/mine/${id}`, { method: "DELETE" }),
};
