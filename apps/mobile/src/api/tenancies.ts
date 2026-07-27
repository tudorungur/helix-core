import { apiRequest } from "./client";
import type { ApiUnitType } from "./properties";

export type ApiContractType = "REGISTERED_ANAF" | "C2B_WITHHOLDING" | "UNREGISTERED_C2C";
export type ApiTenantType = "INDIVIDUAL" | "COMPANY";

// Wire shape returned by services/tenancies. `rentAmount` comes back as a string — `rent_amount` is
// a Postgres `numeric` column, Drizzle's default representation for it. `contractType`/`tenantType`
// are null until a tenant claims the association_code (Section 4.4 phase 2).
export type ApiTenancy = {
  id: string;
  unitId: string;
  startDate: string;
  rentAmount: string;
  rentCurrency: "EUR" | "RON";
  associationCode: string | null;
  status: string;
  contractType: ApiContractType | null;
  tenantType: ApiTenantType | null;
  tenantCompanyName: string | null;
  tenantCompanyCui: string | null;
  anafC168Registered: boolean;
  anafC168RegistrationDate: string | null;
  // The tenant's own declared name for *this* tenancy (not borrowed from `users.name`) — a plain
  // column, present on every response, same as tenantCompanyName. Null until claimed, or once
  // tenantType isn't INDIVIDUAL.
  tenantIndividualName: string | null;
};

// GET /tenancies/mine denormalizes unit/property/legalEntity fields — a real tenant has no
// accountId to separately fetch them with (no account_membership at all). `legalEntity.name` is
// the "who am I renting from" identity, the tenant-side counterpart to `tenantIndividualName`.
export type ApiMyTenancy = ApiTenancy & {
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
};

export type ApiTenancyInput = {
  startDate: string;
  rentAmount: number;
  rentCurrency: "EUR" | "RON";
};

export type ApiClaimTenancyInput =
  | { associationCode: string; tenantType: "INDIVIDUAL"; tenantIndividualName: string }
  | { associationCode: string; tenantType: "COMPANY"; tenantCompanyName: string; tenantCompanyCui: string };

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
