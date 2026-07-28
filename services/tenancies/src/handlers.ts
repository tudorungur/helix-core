import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  legalEntities,
  legalEntityInputSchema,
  properties,
  tenancies,
  tenancyMemberships,
  toLegalEntityPatch,
  toLegalEntityRow,
  units,
} from "@helix-core/domain";
import type { Db } from "@helix-core/domain";
import { HttpError, canWriteUnit } from "./auth.js";
import type { AccountAccess } from "./auth.js";

// ---- Tenant's own legal entities (Section 4.4, 2026-07-27 consolidation) — `userId`-scoped, the
// symmetric counterpart to services/properties' `accountId`-scoped ones: same `legal_entities` row
// shape and PF/PFA/II/IF/SRL/SA mapping (shared via @helix-core/domain), just owned by a person
// directly instead of an account/workspace. A tenant claims a tenancy under one of these, same as an
// owner picks one of theirs for a unit. ----

export async function listMyLegalEntities(db: Db, userId: string) {
  return db.select().from(legalEntities).where(eq(legalEntities.userId, userId));
}

export async function createMyLegalEntity(db: Db, userId: string, body: unknown) {
  const input = legalEntityInputSchema.parse(body);
  const [created] = await db
    .insert(legalEntities)
    .values({ userId, ...toLegalEntityRow(input) })
    .returning();
  return created;
}

export async function updateMyLegalEntity(db: Db, userId: string, id: string, body: unknown) {
  const input = legalEntityInputSchema.partial().parse(body);
  const [updated] = await db
    .update(legalEntities)
    .set(toLegalEntityPatch(input))
    .where(and(eq(legalEntities.id, id), eq(legalEntities.userId, userId)))
    .returning();
  if (!updated) throw new HttpError(404, "Legal entity not found");
  return updated;
}

export async function deleteMyLegalEntity(db: Db, userId: string, id: string) {
  const [deleted] = await db
    .delete(legalEntities)
    .where(and(eq(legalEntities.id, id), eq(legalEntities.userId, userId)))
    .returning({ id: legalEntities.id });
  if (!deleted) throw new HttpError(404, "Legal entity not found");
}

// Section 4.4, phase 1 — the owner picks an unrented unit and creates a tenancy, which generates an
// association_code to pass along however they like. The bilateral fiscal-collection step (a tenant
// claiming that code, picking one of their own legal_entities, creating the tenancy_membership) is
// phase 2, further down this file (`claimTenancy`).

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

// legal_entities.type doesn't distinguish PFA/II/IF or SRL/SA (Section 3.1) — only whether either
// side is UNREGISTERED_INDIVIDUAL matters for deriving contract_type. A registered owner (any
// business form) always issues e-Factura regardless of who the tenant is — B2B and B2C both map to
// the same REGISTERED_ANAF value (Section 1's informal labels aren't stored, only the 3-way
// contract_type enum). Only an unregistered-individual owner branches by whether the tenant's own
// entity is registered too — same collapse as the owner side. **Computed fresh on every read, never
// stored** (2026-07-28) — see the note on `tenancies.contract_type`'s removal in schema.ts for why: a
// stored snapshot went stale the moment either side's `legal_entities.type` changed after the fact.
function deriveContractType(
  ownerLegalEntityType: "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY",
  tenantLegalEntityType: "UNREGISTERED_INDIVIDUAL" | "REGISTERED_INDIVIDUAL" | "REGISTERED_COMPANY",
): "REGISTERED_ANAF" | "C2B_WITHHOLDING" | "UNREGISTERED_C2C" {
  if (ownerLegalEntityType !== "UNREGISTERED_INDIVIDUAL") return "REGISTERED_ANAF";
  return tenantLegalEntityType === "UNREGISTERED_INDIVIDUAL" ? "UNREGISTERED_C2C" : "C2B_WITHHOLDING";
}

// `legalEntities` (plain, no alias) always means the *owner's* own entity below (via
// `units.legal_entity_id`) — `tenantLegalEntities` (aliased) is the tenant's own, needed alongside it
// in the same query to derive `contractType` fresh every time.
const tenantLegalEntities = alias(legalEntities, "tenant_legal_entities");

// Flat, account-wide — same shape as listUnits/listProperties (services/properties' precedent), plus
// a `tenantLegalEntity` denormalized in: the owner has no other way to see who's renting (that
// legal_entities row is `userId`-scoped to the tenant, not part of the owner's own account at all,
// Section 4.4's 2026-07-27 consolidation). LEFT JOIN on the tenant's side — null until claimed
// (`tenantLegalEntityId` is null on a PENDING_TENANT tenancy); INNER JOIN on the owner's own side —
// every unit always has one.
export async function listTenancies(db: Db, access: AccountAccess | null, accountId: string) {
  if (!access) throw new HttpError(403, "No membership on this account");
  const rows = await db
    .select({
      tenancy: tenancies,
      unit: units,
      ownerLegalEntity: legalEntities,
      tenantLegalEntity: tenantLegalEntities,
    })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .innerJoin(legalEntities, eq(legalEntities.id, units.legalEntityId))
    .leftJoin(tenantLegalEntities, eq(tenantLegalEntities.id, tenancies.tenantLegalEntityId))
    .where(eq(properties.accountId, accountId));
  const toApi = (row: (typeof rows)[number]) => ({
    ...row.tenancy,
    contractType: row.tenantLegalEntity
      ? deriveContractType(row.ownerLegalEntity.type, row.tenantLegalEntity.type)
      : null,
    tenantLegalEntity: row.tenantLegalEntity
      ? { id: row.tenantLegalEntity.id, name: row.tenantLegalEntity.legalName, type: row.tenantLegalEntity.type }
      : null,
  });
  if (access.role === "OWNER") return rows.map(toApi);
  return rows
    .filter((row) => access.propertyIds.has(row.unit.propertyId) || access.unitIds.has(row.unit.id))
    .map(toApi);
}

// Every handler that returns a single tenancy resolves `tenantLegalEntity`/`contractType` the same
// way as `listTenancies` — otherwise a create/update/confirmC168 response would silently drop or go
// stale on the field the mobile store merges in place (`tenancies: state.tenancies.map(t => t.id ===
// id ? tenancy : t)`), wiping out an already-known tenant identity (or serving a stale contract type)
// on the next unrelated edit.
async function withTenantLegalEntity(db: Db, tenancyId: string) {
  const [row] = await db
    .select({
      tenancy: tenancies,
      ownerLegalEntity: legalEntities,
      tenantLegalEntity: tenantLegalEntities,
    })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(legalEntities, eq(legalEntities.id, units.legalEntityId))
    .leftJoin(tenantLegalEntities, eq(tenantLegalEntities.id, tenancies.tenantLegalEntityId))
    .where(eq(tenancies.id, tenancyId))
    .limit(1);
  return {
    ...row.tenancy,
    contractType: row.tenantLegalEntity
      ? deriveContractType(row.ownerLegalEntity.type, row.tenantLegalEntity.type)
      : null,
    tenantLegalEntity: row.tenantLegalEntity
      ? { id: row.tenantLegalEntity.id, name: row.tenantLegalEntity.legalName, type: row.tenantLegalEntity.type }
      : null,
  };
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
  return withTenantLegalEntity(db, created.id);
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
  await db.update(tenancies).set(toTenancyPatch(input)).where(eq(tenancies.id, tenancy.id));
  return withTenantLegalEntity(db, tenancy.id);
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
  await db
    .update(tenancies)
    .set({ anafC168Registered: true, anafC168RegistrationDate: new Date().toISOString().slice(0, 10) })
    .where(eq(tenancies.id, tenancy.id));
  return withTenantLegalEntity(db, tenancy.id);
}

// ---- Section 4.4, phase 2 — tenant claims an association_code under one of their own legal_entities ----
// Not account-scoped: the claiming user has no account_membership at all (that's the whole point —
// they're a tenant, not an owner/collaborator), so there's no `accountId`/`AccountAccess` to check
// here. Possession of the code is the authorization.

const claimInput = z.object({
  associationCode: z.string().trim().min(1),
  tenantLegalEntityId: z.string().uuid(),
});

export async function claimTenancy(db: Db, userId: string, body: unknown) {
  const input = claimInput.parse(body);
  const code = input.associationCode.trim().toUpperCase();

  const [tenantEntity] = await db
    .select({ id: legalEntities.id })
    .from(legalEntities)
    .where(and(eq(legalEntities.id, input.tenantLegalEntityId), eq(legalEntities.userId, userId)))
    .limit(1);
  if (!tenantEntity) throw new HttpError(404, "Entitate legală invalidă");

  const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.associationCode, code)).limit(1);
  if (!tenancy) throw new HttpError(404, "Cod de asociere invalid");
  if (tenancy.status !== "PENDING_TENANT") throw new HttpError(409, "Această chirie a fost deja asociată");

  // `associationCode` is kept, not nulled — the owner still needs to see which code was used
  // (Închirieri keeps it visible after association). Re-claiming is already blocked above by the
  // `status !== "PENDING_TENANT"` check, so clearing it isn't needed for that guard either.
  // `contractType` isn't computed/stored here — `withTenantLegalEntity` below derives it fresh from
  // whatever `tenantEntity`'s current `type` is (2026-07-28).
  await db
    .update(tenancies)
    .set({ tenantLegalEntityId: tenantEntity.id, status: "ACTIVE" })
    .where(eq(tenancies.id, tenancy.id));

  await db.insert(tenancyMemberships).values({
    tenancyId: tenancy.id,
    userId,
    role: "PRIMARY_TENANT",
    acceptedAt: new Date(),
  });

  return withTenantLegalEntity(db, tenancy.id);
}

// The tenant has no account_membership to scope a request by — this is scoped by
// tenancy_membership instead, and denormalizes unit/property/legalEntity fields the mobile client
// needs to display "Chiriile mele" (a real tenant can't separately call
// GET /accounts/{accountId}/units or .../legal-entities, they have no accountId at all).
// `legalEntity` is who the tenant is renting *from* (the owner's own entity, via units.legal_entity_id
// — unrelated to the tenant); `tenantLegalEntity` is who the tenant is renting *as* (their own entity,
// picked at claim time) — both joins of the same `legal_entities` table, using the `tenantLegalEntities`
// alias defined above (shared with `listTenancies`/`withTenantLegalEntity`).
export async function listMyTenancies(db: Db, userId: string) {
  const rows = await db
    .select({
      tenancy: tenancies,
      unit: units,
      property: properties,
      legalEntity: legalEntities,
      tenantLegalEntity: tenantLegalEntities,
    })
    .from(tenancyMemberships)
    .innerJoin(tenancies, eq(tenancies.id, tenancyMemberships.tenancyId))
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .innerJoin(legalEntities, eq(legalEntities.id, units.legalEntityId))
    .innerJoin(tenantLegalEntities, eq(tenantLegalEntities.id, tenancies.tenantLegalEntityId))
    .where(eq(tenancyMemberships.userId, userId));

  return rows.map((row) => ({
    ...row.tenancy,
    contractType: deriveContractType(row.legalEntity.type, row.tenantLegalEntity.type),
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
    tenantLegalEntity: {
      id: row.tenantLegalEntity.id,
      name: row.tenantLegalEntity.legalName,
      type: row.tenantLegalEntity.type,
    },
  }));
}
