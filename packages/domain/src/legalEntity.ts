import { z } from "zod";

// Shared between services/properties (account-scoped legal entities, Section 4.3) and
// services/tenancies (user-scoped legal entities a tenant claims a tenancy under, Section 4.4) —
// same `legal_entities` row shape and the same PF/PFA/II/IF/SRL/SA → `legal_entities.type` mapping
// either way (2026-07-27 consolidation), so this lived in one place instead of two copies drifting.

// `cuiCnp`/`invoiceSeries` accept `null` explicitly, not just "absent" — a PATCH that *omits* a key
// means "don't touch this column" (Drizzle skips undefined fields in `.set()`), so clearing a
// previously-set CNP required actually sending `null`, not just leaving the key out.
//
// `name` (business forms) vs `firstName`/`lastName` (PF) are both optional here rather than a
// discriminated union — zod's `.partial()` (used for PATCH below) doesn't compose with discriminated
// unions, and the mobile client already enforces which fields are required per legalForm before ever
// calling the API (OwnerSettingsScreen/TenantSettingsScreen's own `formValid`), so this schema is a
// type/shape guard, not the primary validation layer.
export const legalEntityInputSchema = z.object({
  legalForm: z.enum(["PF", "PFA", "II", "IF", "SRL", "SA"]),
  name: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  cuiCnp: z.string().trim().nullable().optional(),
  vatPayer: z.boolean().optional(),
  invoiceSeries: z.string().trim().nullable().optional(),
});

export type LegalEntityInput = z.infer<typeof legalEntityInputSchema>;

export function legalEntityTypeFor(legalForm: LegalEntityInput["legalForm"]) {
  if (legalForm === "PF") return "UNREGISTERED_INDIVIDUAL" as const;
  if (legalForm === "PFA" || legalForm === "II" || legalForm === "IF") return "REGISTERED_INDIVIDUAL" as const;
  return "REGISTERED_COMPANY" as const;
}

// The rendered display name — `${firstName} ${lastName}`.trim() for PF (2026-07-28: computed here,
// not client-side, so there's exactly one place that ever assembles it), `name` (the trade/company
// name) for business forms.
function legalNameFor(input: Pick<LegalEntityInput, "legalForm" | "name" | "firstName" | "lastName">) {
  if (input.legalForm !== "PF") return input.name;
  if (input.firstName === undefined || input.lastName === undefined) return undefined;
  return `${input.firstName} ${input.lastName}`.trim();
}

// Explicit field-by-field mapping, not `...input` — the wire/zod shape (`name`, `legalForm`) doesn't
// match the table's own column names (`legalName`, derived `type`, no `legalForm` column at all).
export function toLegalEntityRow(input: LegalEntityInput) {
  const isPF = input.legalForm === "PF";
  return {
    type: legalEntityTypeFor(input.legalForm),
    legalName: legalNameFor(input),
    firstName: isPF ? input.firstName : null,
    lastName: isPF ? input.lastName : null,
    cuiCnp: input.cuiCnp,
    vatPayer: input.vatPayer,
    invoiceSeries: input.invoiceSeries,
  };
}

export function toLegalEntityPatch(input: Partial<LegalEntityInput>) {
  const isPF = input.legalForm === "PF";
  return {
    type: input.legalForm ? legalEntityTypeFor(input.legalForm) : undefined,
    legalName: input.legalForm ? legalNameFor(input as LegalEntityInput) : undefined,
    firstName: isPF ? input.firstName : undefined,
    lastName: isPF ? input.lastName : undefined,
    cuiCnp: input.cuiCnp,
    vatPayer: input.vatPayer,
    invoiceSeries: input.invoiceSeries,
  };
}
