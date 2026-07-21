import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { properties, tenancies, units } from "@helix-core/domain";
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
export async function listTenancies(db: Db, access: AccountAccess | null, accountId: string) {
  if (!access) throw new HttpError(403, "No membership on this account");
  const rows = await db
    .select({ tenancy: tenancies, unit: units })
    .from(tenancies)
    .innerJoin(units, eq(units.id, tenancies.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(eq(properties.accountId, accountId));
  if (access.role === "OWNER") return rows.map((row) => row.tenancy);
  return rows
    .filter((row) => access.propertyIds.has(row.unit.propertyId) || access.unitIds.has(row.unit.id))
    .map((row) => row.tenancy);
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
