import { apiRequest } from "./client";

// Wire shapes returned by services/properties — match the real Drizzle column names (camelCase),
// not the old client-only mock shape (e.g. legal entity `legalName`, not `name`; no `hasActiveTenancy`
// on units, that's derived from tenancies server-side and tenancies aren't wired to a backend yet).
export type ApiLegalForm = "PF" | "PFA" | "II" | "IF" | "SRL" | "SA";
export type ApiLegalEntityType = "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY";
export type ApiUnitType = "APARTMENT" | "HOUSE" | "RETAIL" | "WAREHOUSE" | "OFFICE";

export type ApiLegalEntity = {
  id: string;
  accountId: string;
  type: ApiLegalEntityType;
  legalName: string | null;
  cuiCnp: string | null;
  vatPayer: boolean;
  invoiceSeries: string | null;
};

export type ApiLegalEntityInput = {
  legalForm: ApiLegalForm;
  name: string;
  cuiCnp?: string;
  vatPayer?: boolean;
  invoiceSeries?: string;
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
