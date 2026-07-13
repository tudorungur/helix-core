# 🏢 indexo - Application architecture and feature tree

This document outlines the hierarchical tree structure of the utility property management application, divided strictly between backend cloud infrastructure and frontend mobile layers.

---

## System architecture tree

```text
indexo application root
 │
 ├── Section A: Backend infrastructure (AWS cloud layer)
 │    ├── Module 1: authentication and tenant identity core
 │    │    ├── Landlord authentication configurations (AWS Cognito user pools)
 │    │    ├── Secure invitation payload generator for tenant linking
 │    │    └── Dynamic authorization boundary validation (role mapping)
 │    │
 │    ├── Module 2: data persistence and multi-tenant storage
 │    │    ├── Relational database entity blueprints (Aurora serverless PostgreSQL)
 │    │    ├── Data structural isolation enforcement (row-level security parameters)
 │    │    └── Media object storage buckets configuration (Amazon S3 integration)
 │    │
 │    ├── Module 3: calculation engine and business logic
 │    │    ├── Utility consumption delta resolver (current vs. previous index inputs)
 │    │    ├── Combined balance calculator (base rent + active utility cost aggregates)
 │    │    └── Microservices runtime execution handlers (AWS Lambda routines)
 │    │
 │    ├── Module 4: multimodal AI processing pipeline
 │    │    ├── Automated S3 object upload event detection hooks
 │    │    ├── Cloud vision analysis routines (AWS Bedrock using Claude Vision API)
 │    │    └── Schema extraction validator (parsing raw vision output to structured JSON)
 │    │
 │    ├── Module 5: fiscal automation and clearing connectors
 │    │    ├── Digital document generator (serverless PDF layouts for invoices and decont files)
 │    │    ├── Government gateway orchestration layer (ANAF SPV OAuth 2.0 and RO e-Factura XML)
 │    │    └── Commercial payment clearing house interface (Stripe webhook ingestion routes)
 │    │
 │    └── Module 6: asynchronous schedulers and event brokers
 │         ├── Chronological pipeline trigger engines (AWS EventBridge cron framework)
 │         ├── Outbound alert payloads formatter (formatting parameters for push notifications)
 │         └── Telemetry tracking and incident report data persistence layers
 │
 └── Section B: Frontend Mobile Application (cross-platform client layer)
      ├── Module 1: Secure Entry and Profile Initialization
      │    ├── Secure identity token lifecycle handlers (AWS Cognito client SDK routing)
      │    ├── Private client profile workspace configuration (Individual C2C parameter sets)
      │    └── Commercial corporate identity forms (business B2B inputs for registration data)
      │
      ├── Module 2: landlord management center
      │    ├── Real estate asset entry dashboard (property portfolio unit builder)
      │    ├── Unit utility capability toggles (dynamic switches for active household utility types)
      │    ├── Lease metadata constructor (rent cycle schedules, currency triggers for EUR/RON)
      │    └── Global clearing management desk (direct Stripe toggles vs. manual cash tracking)
      │
      ├── Module 3: tenant utility and AI input terminal
      │    ├── Native device camera integration framework (optimized camera capture layer)
      │    ├── Ephemeral binary storage buffers (pre-upload local cache resolution)
      │    └── Dynamic validation interface (reviewing and confirming AI-extracted index numbers)
      │
      ├── Module 4: ledger presentation and payments client
      │    ├── Real-time account balance tracking screen (Dynamic user ledger status overview)
      │    ├── Managed checkout window handlers (Stripe mobile element configurations and Apple Pay)
      │    └── Document storage vault and reader (Native file system previewer for generated PDFs)
      │
      └── Module 5: operations, tickets and communications
           ├── Event-driven navigation routing controllers (Deep-linking handler for push notifications)
           ├── Tenant maintenance ticketing utility (Camera logging for defect reports)
           └── Historical metrics visualizers (Consumption tracking analytics and usage graphs)
```

---

## Technology stack

*   **Mobile Frontend:** Cross-platform framework (iOS primary deployment, ready for Android).
*   **Infrastructure as Code:** Terraform for declarative automation.
*   **Backend & Compute:** AWS API Gateway + AWS Lambda (Node.js/Python).
*   **Database:** Amazon RDS PostgreSQL / Aurora Serverless v2.
*   **Storage & AI:** Amazon S3 (Document/media storage) + AWS Bedrock (Claude Vision API for smart OCR).
*   **CI/CD & GitOps:** GitHub + GitHub Actions (Zero Kubernetes/ArgoCD complexity to stay lean and serverless).
