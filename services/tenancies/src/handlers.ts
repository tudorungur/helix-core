import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { legalEntities, properties, tenancies, tenancyMemberships, units, users } from "@helix-core/domain";
import type { Db } from "@helix-core/domain";
import { HttpError, canWriteUnit } from "./auth.js";
import type { AccountAccess } from "./auth.js";

// Section 4.4, phase 1 — the owner picks an unrented unit and creates a tenancy, which generates an
// association_code to pass along however they like. The bilateral fiscal-collection step a tenant
// runs to *claim* that code (tenant_type, derived contract_type, tenancy_membership) is phase 2, not
// built here — `contract_type`/`tenant_type` are nullable on the table for exactly this reason (see
// SPEC.md §3.1's tenancies implementation-status note).

// Excludes visually ambiguous characters (0/O, 1/I) — read off one screen, typed into another by
// hand. Same alphabet the mobile mock (`portfolioStore.ts`) already used client-side.
const ASSOCIATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateAssociationCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ASSOCIATION_CODE_ALPHABET[Math.floor(Math.random() * ASSOCIATION_CODE_ALPHABET.length)];
  }
  return code;
}

const tenancyInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  rentAmount: z.number().positive(),
  rentCurrency: z.enum(["EUR", "RON"]),
});

// `rent_amount` is a Postgres `numeric` column, which Drizzle represents as a string (no `mode`
// override on this column, Section 3.1) — convert the zod-validated number at the boundary rather
// than changing the column's wire representation.
function toTenancyRow(input: z.infer<typeof tenancyInput>) {
  return {
    startDate: input.startDate,
    rentAmount: input.rentAmount.toString(),
    rentCurrency: input.rentCurrency,
  };
}

function toTenancyPatch(input: Partial<z.infer<typeof tenancyInput>>) {
  return {
    startDate: input.startDate,
    rentAmount: input.rentAmount !== undefined ? input.rentAmount.toString() : undefined,
    rentCurrency: input.rentCurrency,
  };
}

// Flat, account-wide — same shape as listUnits/listProperties (services/properties' precedent).
// Left-joins the PRIMARY_TENANT's own `users.name` — the owner has no way to know who they're
// actually renting to for an INDIVIDUAL tenant otherwise (`tenant_company_name` already covers the
// COMPANY case, but individuals have no name stored anywhere on `tenancies` itself, Section 3.1's
// data-minimization note only ever applied to CNP, not name). Null until claimed (no membership yet).
export async function listTenancies(db: Db, access: AccountAccess | null, accountId: string) {
  if (!access) throw new HttpError(403, "No membership on this account");
  const rows = await db
    .select({ tenancy: tenancies, unit: units, tenantIndividualName: users.name })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .leftJoin(
      tenancyMemberships,
      and(eq(tenancyMemberships.tenancyId, tenancies.id), eq(tenancyMemberships.role, "PRIMARY_TENANT")),
    )
    .leftJoin(users, eq(users.id, tenancyMemberships.userId))
    .where(eq(properties.accountId, accountId));
  const withTenantName = rows.map((row) => ({ ...row.tenancy, tenantIndividualName: row.tenantIndividualName }));
  if (access.role === "OWNER") return withTenantName;
  return rows
    .filter((row) => access.propertyIds.has(row.unit.propertyId) || access.unitIds.has(row.unit.id))
    .map((row) => ({ ...row.tenancy, tenantIndividualName: row.tenantIndividualName }));
}

async function getUnitOrThrow(db: Db, accountId: string, unitId: string) {
  const [row] = await db
    .select({ unit: units })
    .from(units)
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(and(eq(units.id, unitId), eq(properties.accountId, accountId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Unit not found");
  return row.unit;
}

export async function createTenancy(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  unitId: string,
  body: unknown,
) {
  const unit = await getUnitOrThrow(db, accountId, unitId);
  if (!canWriteUnit(access, unit.propertyId, unitId)) throw new HttpError(403, "No write access to this unit");

  // "Unrented" (§4.4) means no currently-open tenancy on this unit — an ended one (end_date set)
  // doesn't block a new one.
  const [openTenancy] = await db
    .select({ id: tenancies.id })
    .from(tenancies)
    .where(and(eq(tenancies.unitId, unitId), isNull(tenancies.endDate)))
    .limit(1);
  if (openTenancy) throw new HttpError(409, "This unit already has an open tenancy");

  const input = tenancyInput.parse(body);
  const [created] = await db
    .insert(tenancies)
    .values({
      unitId,
      ...toTenancyRow(input),
      status: "PENDING_TENANT",
      associationCode: generateAssociationCode(),
    })
    .returning();
  return created;
}

async function getTenancyOrThrow(db: Db, accountId: string, id: string) {
  const [row] = await db
    .select({ tenancy: tenancies, unit: units })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(and(eq(tenancies.id, id), eq(properties.accountId, accountId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Tenancy not found");
  return row;
}

export async function updateTenancy(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  id: string,
  body: unknown,
) {
  const { tenancy, unit } = await getTenancyOrThrow(db, accountId, id);
  if (!canWriteUnit(access, unit.propertyId, unit.id)) throw new HttpError(403, "No write access to this unit");
  const input = tenancyInput.partial().parse(body);
  const [updated] = await db
    .update(tenancies)
    .set(toTenancyPatch(input))
    .where(eq(tenancies.id, tenancy.id))
    .returning();
  return updated;
}

export async function deleteTenancy(db: Db, access: AccountAccess | null, accountId: string, id: string) {
  const { tenancy, unit } = await getTenancyOrThrow(db, accountId, id);
  if (!canWriteUnit(access, unit.propertyId, unit.id)) throw new HttpError(403, "No write access to this unit");
  await db.delete(tenancies).where(eq(tenancies.id, tenancy.id));
}

// Owner self-confirms Form C168 registration was done outside the app (Section 4.4/4.10 — the app
// never submits C168 itself, only tracks that it happened). Mandatory to *show* for
// C2B_WITHHOLDING, optional for UNREGISTERED_C2C, not applicable to REGISTERED_ANAF — that
// distinction is enforced client-side (this endpoint just records the confirmation regardless of
// contract_type, same as any other field edit).
export async function confirmC168(db: Db, access: AccountAccess | null, accountId: string, id: string) {
  const { tenancy, unit } = await getTenancyOrThrow(db, accountId, id);
  if (!canWriteUnit(access, unit.propertyId, unit.id)) throw new HttpError(403, "No write access to this unit");
  const [updated] = await db
    .update(tenancies)
    .set({ anafC168Registered: true, anafC168RegistrationDate: new Date().toISOString().slice(0, 10) })
    .where(eq(tenancies.id, tenancy.id))
    .returning();
  return updated;
}

// ---- Section 4.4, phase 2 — tenant claims an association_code ----
// Not account-scoped: the claiming user has no account_membership at all (that's the whole point —
// they're a tenant, not an owner/collaborator), so there's no `accountId`/`AccountAccess` to check
// here. Possession of the code is the authorization.

// legal_entities.type doesn't distinguish PFA/II/IF or SRL/SA (Section 3.1) — only whether the
// owner is UNREGISTERED_INDIVIDUAL matters for deriving contract_type. A registered owner (any
// business form) always issues e-Factura regardless of who the tenant is — B2B and B2C both map to
// the same REGISTERED_ANAF value (Section 1's informal labels aren't stored, only the 3-way
// contract_type enum). Only an unregistered-individual owner branches by tenant_type.
function deriveContractType(
  legalEntityType: "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY",
  tenantType: "INDIVIDUAL" | "COMPANY",
): "REGISTERED_ANAF" | "C2B_WITHHOLDING" | "UNREGISTERED_C2C" {
  if (legalEntityType !== "UNREGISTERED_INDIVIDUAL") return "REGISTERED_ANAF";
  return tenantType === "COMPANY" ? "C2B_WITHHOLDING" : "UNREGISTERED_C2C";
}

// Tenant's own CNP is deliberately never collected (Section 3.1 — not legally required on an
// invoice to an individual, and `tenancies` has no column for it at all). Only company details are
// asked, and only when tenant_type = COMPANY.
const claimInput = z.discriminatedUnion("tenantType", [
  z.object({
    associationCode: z.string().trim().min(1),
    tenantType: z.literal("INDIVIDUAL"),
  }),
  z.object({
    associationCode: z.string().trim().min(1),
    tenantType: z.literal("COMPANY"),
    tenantCompanyName: z.string().trim().min(1),
    tenantCompanyCui: z.string().trim().min(1),
  }),
]);

export async function claimTenancy(db: Db, userId: string, body: unknown) {
  const input = claimInput.parse(body);
  const code = input.associationCode.trim().toUpperCase();

  const [row] = await db
    .select({ tenancy: tenancies, legalEntity: legalEntities })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(legalEntities, eq(legalEntities.id, units.legalEntityId))
    .where(eq(tenancies.associationCode, code))
    .limit(1);
  if (!row) throw new HttpError(404, "Cod de asociere invalid");
  if (row.tenancy.status !== "PENDING_TENANT") throw new HttpError(409, "Această chirie a fost deja asociată");

  const contractType = deriveContractType(row.legalEntity.type, input.tenantType);

  // `associationCode` is kept, not nulled — the owner still needs to see which code was used
  // (Închirieri keeps it visible after association). Re-claiming is already blocked above by the
  // `status !== "PENDING_TENANT"` check, so clearing it isn't needed for that guard either.
  const [updated] = await db
    .update(tenancies)
    .set({
      tenantType: input.tenantType,
      tenantCompanyName: input.tenantType === "COMPANY" ? input.tenantCompanyName : null,
      tenantCompanyCui: input.tenantType === "COMPANY" ? input.tenantCompanyCui : null,
      contractType,
      status: "ACTIVE",
    })
    .where(eq(tenancies.id, row.tenancy.id))
    .returning();

  await db.insert(tenancyMemberships).values({
    tenancyId: row.tenancy.id,
    userId,
    role: "PRIMARY_TENANT",
    acceptedAt: new Date(),
  });

  return updated;
}

// The tenant has no account_membership to scope a request by — this is scoped by
// tenancy_membership instead, and denormalizes unit/property/legalEntity fields the mobile client
// needs to display "Chiriile mele" (a real tenant can't separately call
// GET /accounts/{accountId}/units or .../legal-entities, they have no accountId at all). The
// legal entity's name is who the tenant is actually renting from — same "who's renting to/from
// whom" need as `listTenancies`' new `tenantIndividualName`, just the other direction.
export async function listMyTenancies(db: Db, userId: string) {
  const rows = await db
    .select({ tenancy: tenancies, unit: units, property: properties, legalEntity: legalEntities })
    .from(tenancyMemberships)
    .innerJoin(tenancies, eq(tenancies.id, tenancyMemberships.tenancyId))
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .innerJoin(legalEntities, eq(legalEntities.id, units.legalEntityId))
    .where(eq(tenancyMemberships.userId, userId));

  return rows.map((row) => ({
    ...row.tenancy,
    unit: { id: row.unit.id, label: row.unit.label, type: row.unit.type },
    property: {
      id: row.property.id,
      streetNumber: row.property.streetNumber,
      street: row.property.street,
      addressLine2: row.property.addressLine2,
      postalCode: row.property.postalCode,
      city: row.property.city,
      county: row.property.county,
    },
    legalEntity: { id: row.legalEntity.id, name: row.legalEntity.legalName },
  }));
}
