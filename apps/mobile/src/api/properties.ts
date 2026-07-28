import { apiRequest } from "./client";

// Wire shapes returned by services/properties — match the real Drizzle column names (camelCase),
// not the old client-only mock shape (e.g. legal entity `legalName`, not `name`; no `hasActiveTenancy`
// on units, that's derived from tenancies server-side and tenancies aren't wired to a backend yet).
export type ApiLegalForm = "PF" | "PFA" | "II" | "IF" | "SRL" | "SA";
export type ApiLegalEntityType = "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY";
export type ApiUnitType = "APARTMENT" | "HOUSE" | "RETAIL" | "WAREHOUSE" | "OFFICE";

// `accountId` xor `userId` (2026-07-27 consolidation) — an owner's own entity (Section 4.3) has
// `accountId` set, a tenant's own entity (Section 4.4) has `userId` set, never both.
export type ApiLegalEntity = {
  id: string;
  accountId: string | null;
  userId: string | null;
  type: ApiLegalEntityType;
  legalName: string | null;
  // PF only (null for business forms) — Nume/Prenume as their own columns, not just folded into
  // `legalName` (2026-07-28: fixes a real edit round-trip bug — see `legal_entities.firstName` in
  // schema.ts for the full story). `firstName` = Prenume, `lastName` = Nume.
  firstName: string | null;
  lastName: string | null;
  cuiCnp: string | null;
  vatPayer: boolean;
  invoiceSeries: string | null;
};

export type ApiLegalEntityInput = {
  legalForm: ApiLegalForm;
  // Business forms send `name` (trade/company name). PF sends `firstName`+`lastName` instead — the
  // server computes `legalName` from them, so there's exactly one place that ever assembles the
  // display string.
  name?: string;
  firstName?: string;
  lastName?: string;
  // `null` (not just omitted) clears a previously-set value — omitting the key means "don't touch
  // this column" server-side, which can't express "the user emptied this field."
  cuiCnp?: string | null;
  vatPayer?: boolean;
  invoiceSeries?: string | null;
};

export type ApiProperty = {
  id: string;
  accountId: string;
  streetNumber: string;
  street: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  county: string;
};

export type ApiPropertyInput = {
  streetNumber: string;
  street: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  county: string;
};

export type ApiUnit = {
  id: string;
  propertyId: string;
  legalEntityId: string;
  label: string;
  type: ApiUnitType;
  active: boolean;
};

export type ApiUnitInput = {
  legalEntityId: string;
  label: string;
  type: ApiUnitType;
  active?: boolean;
};

const base = (accountId: string) => `/accounts/${accountId}`;

export const legalEntitiesApi = {
  list: (accountId: string) => apiRequest<ApiLegalEntity[]>(`${base(accountId)}/legal-entities`),
  create: (accountId: string, input: ApiLegalEntityInput) =>
    apiRequest<ApiLegalEntity>(`${base(accountId)}/legal-entities`, { method: "POST", body: input }),
  update: (accountId: string, id: string, input: Partial<ApiLegalEntityInput>) =>
    apiRequest<ApiLegalEntity>(`${base(accountId)}/legal-entities/${id}`, { method: "PATCH", body: input }),
  remove: (accountId: string, id: string) =>
    apiRequest<void>(`${base(accountId)}/legal-entities/${id}`, { method: "DELETE" }),
};

export const propertiesApi = {
  list: (accountId: string) => apiRequest<ApiProperty[]>(`${base(accountId)}/properties`),
  create: (accountId: string, input: ApiPropertyInput) =>
    apiRequest<ApiProperty>(`${base(accountId)}/properties`, { method: "POST", body: input }),
  update: (accountId: string, id: string, input: Partial<ApiPropertyInput>) =>
    apiRequest<ApiProperty>(`${base(accountId)}/properties/${id}`, { method: "PATCH", body: input }),
  remove: (accountId: string, id: string) =>
    apiRequest<void>(`${base(accountId)}/properties/${id}`, { method: "DELETE" }),
};

export const unitsApi = {
  list: (accountId: string) => apiRequest<ApiUnit[]>(`${base(accountId)}/units`),
  create: (accountId: string, propertyId: string, input: ApiUnitInput) =>
    apiRequest<ApiUnit>(`${base(accountId)}/properties/${propertyId}/units`, { method: "POST", body: input }),
  update: (accountId: string, propertyId: string, id: string, input: Partial<ApiUnitInput>) =>
    apiRequest<ApiUnit>(`${base(accountId)}/properties/${propertyId}/units/${id}`, {
      method: "PATCH",
      body: input,
    }),
  remove: (accountId: string, propertyId: string, id: string) =>
    apiRequest<void>(`${base(accountId)}/properties/${propertyId}/units/${id}`, { method: "DELETE" }),
};
