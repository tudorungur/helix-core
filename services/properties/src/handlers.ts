import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { legalEntities, properties, units } from "@helix-core/domain";
import type { Db } from "@helix-core/domain";
import { HttpError, canWriteProperty, canWriteUnit, requireOwner } from "./auth.js";
import type { AccountAccess } from "./auth.js";

// ---- Legal entities (Section 4.3) — owner-only, same rationale as "requireOwner" in auth.ts: a
// legal entity isn't scoped to any property/unit, so a collaborator's scope can't apply to it. ----

const legalEntityInput = z.object({
  legalForm: z.enum(["PF", "PFA", "II", "IF", "SRL", "SA"]),
  name: z.string().trim().min(1),
  cuiCnp: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  invoiceSeries: z.string().trim().optional(),
});

function legalEntityTypeFor(legalForm: z.infer<typeof legalEntityInput>["legalForm"]) {
  if (legalForm === "PF") return "UNREGISTERED_INDIVIDUAL" as const;
  if (legalForm === "PFA" || legalForm === "II" || legalForm === "IF") return "REGISTERED_INDIVIDUAL" as const;
  return "REGISTERED_COMPANY" as const;
}

// Explicit field-by-field mapping, not `...input` — the wire/zod shape (`name`, `legalForm`) doesn't
// match the table's own column names (`legalName`, derived `type`, no `legalForm` column at all).
// Spreading a *variable* into an object literal skips TypeScript's excess-property check, so a
// mismatch like this silently inserted nulls instead of failing to compile (caught by hand, testing
// against the real dev DB — Drizzle happily ignores unknown keys in `.values()`/`.set()`).
function toLegalEntityRow(input: z.infer<typeof legalEntityInput>) {
  return {
    type: legalEntityTypeFor(input.legalForm),
    legalName: input.name,
    cuiCnp: input.cuiCnp,
    vatPayer: input.vatPayer,
    invoiceSeries: input.invoiceSeries,
  };
}

function toLegalEntityPatch(input: Partial<z.infer<typeof legalEntityInput>>) {
  return {
    type: input.legalForm ? legalEntityTypeFor(input.legalForm) : undefined,
    legalName: input.name,
    cuiCnp: input.cuiCnp,
    vatPayer: input.vatPayer,
    invoiceSeries: input.invoiceSeries,
  };
}

export async function listLegalEntities(db: Db, access: AccountAccess | null, accountId: string) {
  requireOwner(access);
  return db.select().from(legalEntities).where(eq(legalEntities.accountId, accountId));
}

export async function createLegalEntity(db: Db, access: AccountAccess | null, accountId: string, body: unknown) {
  requireOwner(access);
  const input = legalEntityInput.parse(body);
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
  const input = legalEntityInput.partial().parse(body);
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
// mobile app yet and nothing here depends on them functionally (utility QUOTA_SHARE tariffs store a
// manually-entered `quota_percentage`, not one derived from area) — left out of the API input on
// purpose until there's an actual use for them. Add back with an explicit numeric→string conversion
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
