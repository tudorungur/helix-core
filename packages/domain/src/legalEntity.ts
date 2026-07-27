import { z } from "zod";

// Shared between services/properties (account-scoped legal entities, Section 4.3) and
// services/tenancies (user-scoped legal entities a tenant claims a tenancy under, Section 4.4) —
// same `legal_entities` row shape and the same PF/PFA/II/IF/SRL/SA → `legal_entities.type` mapping
// either way (2026-07-27 consolidation), so this lived in one place instead of two copies drifting.

// `cuiCnp`/`invoiceSeries` accept `null` explicitly, not just "absent" — a PATCH that *omits* a key
// means "don't touch this column" (Drizzle skips undefined fields in `.set()`), so clearing a
// previously-set CNP required actually sending `null`, not just leaving the key out.
export const legalEntityInputSchema = z.object({
  legalForm: z.enum(["PF", "PFA", "II", "IF", "SRL", "SA"]),
  name: z.string().trim().min(1),
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

// Explicit field-by-field mapping, not `...input` — the wire/zod shape (`name`, `legalForm`) doesn't
// match the table's own column names (`legalName`, derived `type`, no `legalForm` column at all).
export function toLegalEntityRow(input: LegalEntityInput) {
  return {
    type: legalEntityTypeFor(input.legalForm),
    legalName: input.name,
    cuiCnp: input.cuiCnp,
    vatPayer: input.vatPayer,
    invoiceSeries: input.invoiceSeries,
  };
}

export function toLegalEntityPatch(input: Partial<LegalEntityInput>) {
  return {
    type: input.legalForm ? legalEntityTypeFor(input.legalForm) : undefined,
    legalName: input.name,
    cuiCnp: input.cuiCnp,
    vatPayer: input.vatPayer,
    invoiceSeries: input.invoiceSeries,
  };
}
