import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// This schema mirrors SPEC.md Section 3.1 field-for-field. If the data model changes,
// update SPEC.md first — it's the source of truth, this file follows it.

// ---------- Enums ----------

// SQL type name stays "account_type" — same 3 values as before, just referenced from legalEntities
// now instead of accounts (Section 3.1); not a semantic rename, so keeping the DB identifier avoids
// drizzle-kit's ambiguous rename-vs-recreate prompt for an unchanged enum.
export const legalEntityType = pgEnum("account_type", [
  "REGISTERED_INDIVIDUAL",
  "REGISTERED_COMPANY",
  "UNREGISTERED_INDIVIDUAL",
]);
export const membershipRole = pgEnum("membership_role", [
  "OWNER",
  "COLLABORATOR",
  "ACCOUNTANT_READONLY",
]);
// Shared by both properties.type and units.type (Section 3.1) — one taxonomy across the app, not
// two overlapping ones. A property's type is asked at property-creation time (before any unit
// exists); a mixed-use property can still hold units of a different sub-type than the property
// itself (e.g. an APARTMENT-type property with a ground-floor RETAIL unit).
export const unitType = pgEnum("unit_type", [
  "APARTMENT",
  "HOUSE",
  "RETAIL",
  "WAREHOUSE",
  "OFFICE",
]);
export const utilityType = pgEnum("utility_type", [
  "COLD_WATER",
  "HOT_WATER",
  "GAS",
  "ELECTRICITY",
  "INTERNET",
  "TRASH",
  "MAINTENANCE",
  "OTHER",
]);
export const tariffBasis = pgEnum("tariff_basis", [
  "METER_INDEX",
  "FIXED_COST",
  "QUOTA_SHARE",
  "PER_PERSON",
]);
export const contractType = pgEnum("contract_type", [
  "REGISTERED_ANAF",
  "C2B_WITHHOLDING",
  "UNREGISTERED_C2C",
]);
export const tenantType = pgEnum("tenant_type", ["INDIVIDUAL", "COMPANY"]);
export const currencyCode = pgEnum("currency_code", ["EUR", "RON"]);
export const tenancyMembershipRole = pgEnum("tenancy_membership_role", [
  "PRIMARY_TENANT",
  "CO_TENANT",
]);
export const meterReadingStatus = pgEnum("meter_reading_status", [
  "PENDING_AI",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
]);
export const invoiceType = pgEnum("invoice_type", ["AUTO_EFACTURA", "MANUAL_DECONT"]);
export const invoiceStatus = pgEnum("invoice_status", [
  "DRAFT",
  "ISSUED",
  "SENT_ANAF",
  "PAID",
  "OVERDUE",
]);
export const paymentMethod = pgEnum("payment_method", ["MANUAL", "NETOPIA_CARD"]);
export const ticketStatus = pgEnum("ticket_status", ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const depositStatus = pgEnum("deposit_status", [
  "HELD",
  "RETAINED_RENT",
  "RETAINED_DAMAGE",
  "RETURNED",
]);
export const depositPhotoPhase = pgEnum("deposit_photo_phase", ["MOVE_IN", "MOVE_OUT"]);

// ---------- Identity & multi-tenancy hierarchy ----------

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // Cognito sub
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  name: varchar("name", { length: 200 }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Just a workspace/display label (defaults to the owner's own name at signup, renamable later) —
  // no fiscal identity lives here anymore, see legalEntities below.
  name: varchar("name", { length: 200 }).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
});

// A fiscal identity an account can invoice/be invoiced under — a Persoană Fizică identity (CNP-based)
// or a specific registered business (PFA/II/IF/SRL/SA, CUI-based). One account can hold multiple —
// e.g. renting one property as a Persoană Fizică and another through an SRL. Each property picks
// exactly one, which decides that property's e-Factura eligibility, not the account as a whole.
export const legalEntities = pgTable("legal_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  type: legalEntityType("type").notNull(),
  legalName: varchar("legal_name", { length: 200 }),
  // A CNP identifies exactly one person and a CUI exactly one company — either should back at
  // most one legal entity on the platform, so this is a real key, not just an identifier. Collected
  // immediately for business types (at property-add time, no purpose without it); deferred to the
  // entity's first tenancy for UNREGISTERED_INDIVIDUAL (CNP is specially-protected personal data).
  cuiCnp: varchar("cui_cnp", { length: 20 }).unique(),
  vatPayer: boolean("vat_payer").notNull().default(false),
  invoiceSeries: varchar("invoice_series", { length: 10 }),
  invoiceNextNumber: integer("invoice_next_number").notNull().default(1),
  anafOauthStatus: varchar("anaf_oauth_status", { length: 30 }),
});

export const accountMemberships = pgTable("account_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: membershipRole("role").notNull(),
});

export const accountMembershipScopes = pgTable("account_membership_scopes", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id").notNull().references(() => accountMemberships.id),
  propertyId: uuid("property_id").references(() => properties.id),
  unitId: uuid("unit_id").references(() => units.id),
});

// Just the building — an address container. No type, no legal entity: a single property can hold
// units of different types and different legal entities (Section 3.1's note on units below).
export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  streetNumber: varchar("street_number", { length: 20 }).notNull(),
  street: varchar("street", { length: 200 }).notNull(),
  addressLine2: varchar("address_line2", { length: 200 }), // bloc/scară/etaj/ap., optional
  postalCode: varchar("postal_code", { length: 10 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  county: varchar("county", { length: 100 }).notNull(),
});

// The actual rentable/invoiceable thing — carries both its type (asked here, not on the building)
// and which legal entity it's invoiced under (also here, not on the building): a single building can
// have units of different types and, since one account can hold multiple legal_entities (Section
// 3.1), units billed under different fiscal identities too (e.g. one apartment rented as a Persoană
// Fizică, another through an SRL, in the same building).
export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  legalEntityId: uuid("legal_entity_id").notNull().references(() => legalEntities.id),
  label: varchar("label", { length: 100 }).notNull(),
  type: unitType("type").notNull(),
  areaSqm: numeric("area_sqm"),
  rooms: integer("rooms"),
  // Deactivating hides this unit from new-tenancy eligibility without deleting it — distinct from
  // an actual delete (Section 4.3). Lives here, not on `properties`: a building can have some units
  // still rentable and others taken off the market, so "active" only makes sense per-unit (moved
  // down from property-level after trying it there first — a building-wide toggle didn't hold up
  // once landlords could have some units still rentable and others not).
  active: boolean("active").notNull().default(true),
});

export const unitUtilities = pgTable("unit_utilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  utilityType: utilityType("utility_type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  tariffBasis: tariffBasis("tariff_basis").notNull(),
  unitPrice: numeric("unit_price"), // METER_INDEX
  fixedAmount: numeric("fixed_amount"), // FIXED_COST
  quotaPercentage: numeric("quota_percentage"), // QUOTA_SHARE
  sequenceOrder: integer("sequence_order").notNull().default(0),
});

// ---------- Tenancy & FX ----------

export const tenancies = pgTable("tenancies", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id").notNull().references(() => units.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  // Nullable: unknown until the tenant claims the association_code and supplies tenant_type
  // (Section 4.4) — contract_type is then *derived* from tenant_type × the unit's legal_entity.type,
  // never asked directly. `status` carries the interim lifecycle ("PENDING_TENANT" until claimed,
  // "ACTIVE" after) — free-form varchar, not an enum, so this phasing didn't need a schema change.
  contractType: contractType("contract_type"),
  status: varchar("status", { length: 30 }).notNull(),
  rentAmount: numeric("rent_amount").notNull(),
  rentCurrency: currencyCode("rent_currency").notNull(),
  // ANAF Form C168 registration tracking (Section 4.4) — mandatory for C2B_WITHHOLDING,
  // optional for UNREGISTERED_C2C, not applicable to REGISTERED_ANAF.
  anafC168Registered: boolean("anaf_c168_registered").notNull().default(false),
  anafC168RegistrationDate: date("anaf_c168_registration_date"),
  // Drives the informal B2B/C2B (COMPANY) vs B2C/C2C (INDIVIDUAL) label (Section 1) — not accounts.type.
  // Nullable for the same reason as contract_type: only the tenant can answer this, at claim time.
  tenantType: tenantType("tenant_type"),
  // Only set when tenant_type = COMPANY — the fiscal identity for e-Factura (B2B) or the withholding
  // statement (C2B); the individual linked via tenancy_memberships may just be an employee, not the
  // fiscal entity itself.
  tenantCompanyName: varchar("tenant_company_name", { length: 200 }),
  tenantCompanyCui: varchar("tenant_company_cui", { length: 20 }),
  // Generated when the owner creates the tenancy, replacing an email/SMS invite (Section 4.4) — the
  // tenant self-registers and enters this to link. Cleared once claimed.
  associationCode: varchar("association_code", { length: 12 }),
});

export const bnrExchangeRates = pgTable("bnr_exchange_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  rateDate: date("rate_date").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  rateToRon: numeric("rate_to_ron").notNull(),
});

export const tenancyMemberships = pgTable("tenancy_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: tenancyMembershipRole("role").notNull(),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

// ---------- Metering ----------

export const meterReadings = pgTable("meter_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitUtilityId: uuid("unit_utility_id").notNull().references(() => unitUtilities.id),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  photoS3Key: varchar("photo_s3_key", { length: 500 }),
  aiExtractedValue: numeric("ai_extracted_value"),
  aiConfidence: numeric("ai_confidence"),
  confirmedValue: numeric("confirmed_value"),
  confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id),
  status: meterReadingStatus("status").notNull().default("PENDING_AI"),
});

// ---------- Invoicing ----------

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Which fiscal identity issues it (series/numbering, Section 4.6) — not accounts.id, since an
  // account can hold multiple legal entities each with their own invoice series.
  legalEntityId: uuid("legal_entity_id").notNull().references(() => legalEntities.id),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  period: varchar("period", { length: 7 }).notNull(),
  invoiceType: invoiceType("invoice_type").notNull(),
  series: varchar("series", { length: 10 }).notNull(),
  number: varchar("number", { length: 20 }).notNull(),
  vatAmount: numeric("vat_amount").notNull().default("0"),
  totalAmount: numeric("total_amount").notNull(),
  status: invoiceStatus("status").notNull().default("DRAFT"),
  anafUploadId: varchar("anaf_upload_id", { length: 100 }),
  pdfS3Key: varchar("pdf_s3_key", { length: 500 }),
});

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  unitUtilityId: uuid("unit_utility_id").references(() => unitUtilities.id), // null for the rent line
  description: varchar("description", { length: 200 }).notNull(),
  quantity: numeric("quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount").notNull(),
  // Rent line only — EUR->RON audit trail (Section 4.6)
  sourceAmount: numeric("source_amount"),
  sourceCurrency: varchar("source_currency", { length: 3 }),
  fxRateUsed: numeric("fx_rate_used"),
  fxRateDate: date("fx_rate_date"),
  // Rent line only, on a C2B_WITHHOLDING tenancy (Section 4.10)
  withholdingTaxRate: numeric("withholding_tax_rate"),
  withholdingTaxAmount: numeric("withholding_tax_amount"),
  netAmountDue: numeric("net_amount_due"),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  amount: numeric("amount").notNull(),
  method: paymentMethod("method").notNull(),
  markedByUserId: uuid("marked_by_user_id").references(() => users.id),
  netopiaTransactionId: varchar("netopia_transaction_id", { length: 100 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: varchar("status", { length: 30 }).notNull(),
});

// ---------- Maintenance tickets (Section 4.9, Phase 3) ----------

export const maintenanceTickets = pgTable("maintenance_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  unitId: uuid("unit_id").notNull().references(() => units.id), // denormalized for Section 3.2 scope checks
  reportedByUserId: uuid("reported_by_user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatus("status").notNull().default("OPEN"),
  photoS3Key: varchar("photo_s3_key", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const maintenanceTicketComments = pgTable("maintenance_ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => maintenanceTickets.id),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Security deposit (Section 4.11, Phase 3) ----------

export const deposits = pgTable("deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenancyId: uuid("tenancy_id").notNull().references(() => tenancies.id),
  amount: numeric("amount").notNull(),
  currency: currencyCode("currency").notNull(),
  status: depositStatus("status").notNull().default("HELD"),
  paymentMethod: paymentMethod("payment_method").notNull(),
  netopiaTransactionId: varchar("netopia_transaction_id", { length: 100 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  retainedAmount: numeric("retained_amount"),
  // Handover protocol / repair invoice backing a withheld amount (Section 4.11)
  retentionJustificationS3Key: varchar("retention_justification_s3_key", { length: 500 }),
});

export const depositConditionPhotos = pgTable("deposit_condition_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  depositId: uuid("deposit_id").notNull().references(() => deposits.id),
  phase: depositPhotoPhase("phase").notNull(),
  photoS3Key: varchar("photo_s3_key", { length: 500 }).notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Relations (enables db.query.x.findFirst({ with: { ... } })) ----------

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
}));

export const maintenanceTicketsRelations = relations(maintenanceTickets, ({ many }) => ({
  comments: many(maintenanceTicketComments),
}));

export const depositsRelations = relations(deposits, ({ many }) => ({
  conditionPhotos: many(depositConditionPhotos),
}));
