import { apiRequest } from "./client";

// Wire shape returned by services/tenancies (Section 4.4, phase 1). `rentAmount` comes back as a
// string — `rent_amount` is a Postgres `numeric` column, Drizzle's default representation for it.
// No `tenantType`/`contractType`/`associated` concept yet on the wire — those are phase 2 (tenant
// claims the code), not built server-side yet.
export type ApiTenancy = {
  id: string;
  unitId: string;
  startDate: string;
  rentAmount: string;
  rentCurrency: "EUR" | "RON";
  associationCode: string | null;
  status: string;
};

export type ApiTenancyInput = {
  startDate: string;
  rentAmount: number;
  rentCurrency: "EUR" | "RON";
};

const base = (accountId: string) => `/accounts/${accountId}`;

export const tenanciesApi = {
  list: (accountId: string) => apiRequest<ApiTenancy[]>(`${base(accountId)}/tenancies`),
  create: (accountId: string, unitId: string, input: ApiTenancyInput) =>
    apiRequest<ApiTenancy>(`${base(accountId)}/units/${unitId}/tenancies`, { method: "POST", body: input }),
  update: (accountId: string, id: string, input: Partial<ApiTenancyInput>) =>
    apiRequest<ApiTenancy>(`${base(accountId)}/tenancies/${id}`, { method: "PATCH", body: input }),
  remove: (accountId: string, id: string) =>
    apiRequest<void>(`${base(accountId)}/tenancies/${id}`, { method: "DELETE" }),
};
