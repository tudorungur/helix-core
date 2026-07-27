import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  legalEntities,
  legalEntityInputSchema,
  properties,
  toLegalEntityPatch,
  toLegalEntityRow,
  units,
} from "@helix-core/domain";
import type { Db } from "@helix-core/domain";
import { HttpError, canWriteProperty, canWriteUnit, requireOwner } from "./auth.js";
import type { AccountAccess } from "./auth.js";

// ---- Legal entities (Section 4.3) — owner-only, same rationale as "requireOwner" in auth.ts: a
// legal entity isn't scoped to any property/unit, so a collaborator's scope can't apply to it.
// `legalEntityInputSchema`/`toLegalEntityRow`/`toLegalEntityPatch` are shared with services/tenancies'
// user-scoped "my legal entities" (Section 4.4, 2026-07-27 consolidation) — same row shape, same
// PF/PFA/II/IF/SRL/SA mapping, only `accountId` vs `userId` differs. ----

export async function listLegalEntities(db: Db, access: AccountAccess | null, accountId: string) {
  requireOwner(access);
  return db.select().from(legalEntities).where(eq(legalEntities.accountId, accountId));
}

export async function createLegalEntity(db: Db, access: AccountAccess | null, accountId: string, body: unknown) {
  requireOwner(access);
  const input = legalEntityInputSchema.parse(body);
  const [created] = await db
    .insert(legalEntities)
    .values({ accountId, ...toLegalEntityRow(input) })
    .returning();
  return created;
}

export async function updateLegalEntity(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  id: string,
  body: unknown,
) {
  requireOwner(access);
  const input = legalEntityInputSchema.partial().parse(body);
  const [updated] = await db
    .update(legalEntities)
    .set(toLegalEntityPatch(input))
    .where(and(eq(legalEntities.id, id), eq(legalEntities.accountId, accountId)))
    .returning();
  if (!updated) throw new HttpError(404, "Legal entity not found");
  return updated;
}

export async function deleteLegalEntity(db: Db, access: AccountAccess | null, accountId: string, id: string) {
  requireOwner(access);
  const [deleted] = await db
    .delete(legalEntities)
    .where(and(eq(legalEntities.id, id), eq(legalEntities.accountId, accountId)))
    .returning({ id: legalEntities.id });
  if (!deleted) throw new HttpError(404, "Legal entity not found");
}

// ---- Properties (Section 4.3) — just the building, no type/legal entity/active (those live on
// units). Listing/creating is owner-only for the same "nothing to scope yet" reason as legal
// entities; editing/deleting an existing property is allowed for a collaborator scoped to it. ----

const propertyInput = z.object({
  streetNumber: z.string().trim().min(1),
  street: z.string().trim().min(1),
  addressLine2: z.string().trim().optional(),
  postalCode: z.string().trim().min(1),
  city: z.string().trim().min(1),
  county: z.string().trim().min(1),
});

export async function listProperties(db: Db, access: AccountAccess | null, accountId: string) {
  if (!access) throw new HttpError(403, "No membership on this account");
  const all = await db.select().from(properties).where(eq(properties.accountId, accountId));
  if (access.role === "OWNER") return all;
  return all.filter((property) => access.propertyIds.has(property.id));
}

export async function createProperty(db: Db, access: AccountAccess | null, accountId: string, body: unknown) {
  requireOwner(access);
  const input = propertyInput.parse(body);
  const [created] = await db
    .insert(properties)
    .values({ accountId, ...input })
    .returning();
  return created;
}

export async function updateProperty(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  id: string,
  body: unknown,
) {
  if (!canWriteProperty(access, id)) throw new HttpError(403, "No write access to this property");
  const input = propertyInput.partial().parse(body);
  const [updated] = await db
    .update(properties)
    .set(input)
    .where(and(eq(properties.id, id), eq(properties.accountId, accountId)))
    .returning();
  if (!updated) throw new HttpError(404, "Property not found");
  return updated;
}

export async function deleteProperty(db: Db, access: AccountAccess | null, accountId: string, id: string) {
  // Deleting (not just editing) a property is still owner-only — a collaborator scoped to a
  // property can manage it, not remove it from the portfolio outright.
  requireOwner(access);
  const [deleted] = await db
    .delete(properties)
    .where(and(eq(properties.id, id), eq(properties.accountId, accountId)))
    .returning({ id: properties.id });
  if (!deleted) throw new HttpError(404, "Property not found");
}

// ---- Units (Section 4.3) — the actual rentable thing: type, legal entity, and active all live
// here, not on the property (Section 3.1's note on a mixed-status building). ----

// `units.area_sqm`/`rooms` exist on the table (pre-dating this service) but aren't collected by the
// mobile app yet and nothing depends on them functionally — left out of the API input on purpose
// until there's an actual use for them. Add back with an explicit numeric→string conversion
// (`units.area_sqm` is Postgres `numeric`, which Drizzle represents as a string) if that changes.
const unitInput = z.object({
  legalEntityId: z.string().uuid(),
  label: z.string().trim().min(1),
  type: z.enum(["APARTMENT", "HOUSE", "RETAIL", "WAREHOUSE", "OFFICE"]),
  active: z.boolean().optional(),
});

// Flat, account-wide — matches the mobile client's own flat `units` array (not nested per
// property), which needs to know about every unit up front (Închirieri's picker, Portofoliu's list)
// without a separate request per property.
export async function listUnits(db: Db, access: AccountAccess | null, accountId: string) {
  if (!access) throw new HttpError(403, "No membership on this account");
  const rows = await db
    .select({ unit: units })
    .from(units)
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(eq(properties.accountId, accountId));
  const all = rows.map((row) => row.unit);
  if (access.role === "OWNER") return all;
  return all.filter((unit) => access.propertyIds.has(unit.propertyId) || access.unitIds.has(unit.id));
}

async function getPropertyOrThrow(db: Db, accountId: string, propertyId: string) {
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.accountId, accountId)))
    .limit(1);
  if (!property) throw new HttpError(404, "Property not found");
  return property;
}

// A unit's `legalEntityId` was accepted with no ownership check at all — since legal_entities can now
// also be `userId`-scoped (a tenant's own identity, Section 4.4's 2026-07-27 consolidation), an
// unvalidated UUID here could point a unit at a *tenant's personal* legal entity instead of one of this
// account's own, not just another account's. Same "must belong to me" check `claimTenancy` already
// applies on the tenant side (`legalEntities.userId = userId`), mirrored here for the owner side.
async function assertLegalEntityBelongsToAccount(db: Db, accountId: string, legalEntityId: string) {
  const [entity] = await db
    .select({ id: legalEntities.id })
    .from(legalEntities)
    .where(and(eq(legalEntities.id, legalEntityId), eq(legalEntities.accountId, accountId)))
    .limit(1);
  if (!entity) throw new HttpError(404, "Legal entity not found");
}

export async function createUnit(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  propertyId: string,
  body: unknown,
) {
  await getPropertyOrThrow(db, accountId, propertyId);
  if (!canWriteProperty(access, propertyId)) throw new HttpError(403, "No write access to this property");
  const input = unitInput.omit({ active: true }).parse(body);
  await assertLegalEntityBelongsToAccount(db, accountId, input.legalEntityId);
  const [created] = await db
    .insert(units)
    .values({ propertyId, ...input, active: true })
    .returning();
  return created;
}

export async function updateUnit(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  propertyId: string,
  id: string,
  body: unknown,
) {
  await getPropertyOrThrow(db, accountId, propertyId);
  if (!canWriteUnit(access, propertyId, id)) throw new HttpError(403, "No write access to this unit");
  const input = unitInput.partial().parse(body);
  if (input.legalEntityId) await assertLegalEntityBelongsToAccount(db, accountId, input.legalEntityId);
  const [updated] = await db
    .update(units)
    .set(input)
    .where(and(eq(units.id, id), eq(units.propertyId, propertyId)))
    .returning();
  if (!updated) throw new HttpError(404, "Unit not found");
  return updated;
}

export async function deleteUnit(
  db: Db,
  access: AccountAccess | null,
  accountId: string,
  propertyId: string,
  id: string,
) {
  await getPropertyOrThrow(db, accountId, propertyId);
  if (!canWriteUnit(access, propertyId, id)) throw new HttpError(403, "No write access to this unit");
  const [deleted] = await db
    .delete(units)
    .where(and(eq(units.id, id), eq(units.propertyId, propertyId)))
    .returning({ id: units.id });
  if (!deleted) throw new HttpError(404, "Unit not found");
}
