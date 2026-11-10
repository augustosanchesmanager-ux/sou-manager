# Architecture: Compliance & Legal (Phase 6.0.6)

> **Status:** Architectural Design (Documentary Phase)
> **Version:** 1.0.0
> **Date:** 2026-09-02
> **Release Target:** v1.5

## 1. Introduction & Objectives

This document defines the architecture for legal compliance, document management, and LGPD adherence within the SMG Platform. The goal is to ensure that the platform operates with a formal, versioned, and auditable legal framework, transforming "legal acceptance" into a technical gate for product access.

### 1.1 Core Objectives
- **Immutability:** Legal documents and their acceptances must be append-only. No deletion or editing of historical versions.
- **Integrity:** Every document version must be identified by a cryptographic hash (SHA-256).
- **Auditability:** Every acceptance must be recorded with a full forensic trail (IP, User-Agent, Timestamp).
- **Enforcement:** Mandatory documents must block application access if not accepted in their current version.

---

## 2. Data Model

The system follows the "Append-Only" pattern used in the Event Store and Processed Operations.

### 2.1 Entity Definition

#### `legal_documents` (The Catalogue)
Identity of the legal documents managed by the platform.
- `id` (UUID, PK)
- `slug` (TEXT, UNIQUE) — e.g., `terms_of_use`, `privacy_policy`, `lgpd_consent`.
- `name` (TEXT) — Human-readable name.
- `is_mandatory` (BOOLEAN) — If `true`, triggers forced re-acceptance on version change.
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `document_versions` (Immutable Content)
The actual content of each version of a document.
- `id` (UUID, PK)
- `document_id` (UUID, FK $\to$ `legal_documents`)
- `version` (TEXT) — Semantic or temporal version (e.g., "1.0.1").
- `content` (TEXT) — The full text of the document.
- `content_hash` (TEXT) — SHA-256 hash of the content for integrity verification.
- `published_at` (TIMESTAMPTZ)
- `is_current` (BOOLEAN) — Only one version per document can be the "current" active version.
- `created_at` (TIMESTAMPTZ)

#### `accepted_documents` (The Audit Trail)
The record of every single acceptance event.
- `id` (UUID, PK)
- `user_id` (UUID, FK $\to$ `auth.users`)
- `tenant_id` (UUID, FK $\to$ `tenants`)
- `version_id` (UUID, FK $\to$ `document_versions`)
- `accepted_at` (TIMESTAMPTZ)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 2.2 Architectural Invariants
1. **No Updates:** `document_versions` and `accepted_documents` are read-only after insertion.
2. **Hash Verification:** When a user accepts a document, the current hash must be logged.
3. **Tenant Isolation:** RLS policies ensure that acceptance records are scoped to the tenant, with a Superadmin bypass for auditing.

---

## 3. Operational Flows

### 3.1 The Acceptance Logic
The system must verify compliance at every login or session refresh.

**Algorithm for Re-acceptance Check:**
1. Identify all `legal_documents` where `is_mandatory = true`.
2. For each mandatory document:
    - Retrieve the `document_version` where `is_current = true` (**CurrentVersion**).
    - Retrieve the most recent record from `accepted_documents` for the user/tenant for this document (**UserAcceptedVersion**).
    - Compare `CurrentVersion.id` with `UserAcceptedVersion.id`.
    - If `UserAcceptedVersion` is NULL OR `UserAcceptedVersion.id != CurrentVersion.id` $\to$ **Set `is_reacceptance_required = true`**.

**Frontend Enforcement:**
A `LegalGuard` component wraps the application. If `is_reacceptance_required` is true, the user is redirected to a forced `LegalAcceptancePage`, blocking all other routes until all mandatory current versions are accepted.

### 3.2 LGPD Implementation (Data Privacy)

The platform must provide technical means to satisfy LGPD requirements:

- **Data Portability (Export):**
    - Trigger: User request via Legal Center.
    - Execution: A background process gathers all records linked to the `user_id` across all domain tables.
    - Delivery: A secure, time-limited link to a JSON/CSV bundle in Supabase Storage.

- **Right to be Forgotten (Deletion):**
    - Trigger: Approved deletion request.
    - Process: Soft-delete first (status $\to$ `archived`), followed by a hard-delete worker after the legal retention period (defined by the PO).
    - Constraint: Financial and tax-related records must be preserved according to Brazilian law regardless of the deletion request.

- **Consent Management:**
    - Consent is treated as a non-mandatory legal document.
    - The `accepted_documents` table serves as the legal proof of consent (Audit Trail).

---

## 4. Administrative Legal Center

A specialized administrative module for governance and auditing.

### 4.1 User Personas & Capabilities
- **Superadmin:** 
    - Publish new document versions (Update `is_current` and insert new `document_versions`).
    - Audit any tenant's compliance status.
    - Manage the legal catalogue.
- **Tenant Admin:** 
    - View acceptance status of their staff.
    - Export legal audit trails for their own tenant.

### 4.2 Key Views
- **Compliance Matrix:** A grid showing `Users` $\times$ `Mandatory Documents` with status indicators (✅ Current, ⚠️ Outdated, ❌ Not Accepted).
- **Version History:** A timeline of document changes with hash verification.
- **LGPD Console:** Management of data export and deletion requests.

---

## 5. Integration with SaaS Core

The legal acceptance is a critical step in the customer journey.

**Official Onboarding Flow:**
`Signup` $\to$ `Provisioning` $\to$ `Onboarding` $\to$ **`Legal Acceptance`** $\to$ `Tenant Creation` $\to$ `Dashboard`.

The system ensures that no tenant is fully "active" and no business data is created until the legal baseline is accepted.

---

## 6. Release Gate v1.5

The Release v1.5 is certified as **complete** only when:
- [ ] All core legal documents exist (Terms, Privacy, LGPD, Contract).
- [ ] Electronic acceptance and versioning are fully implemented.
- [ ] Re-acceptance block is operational.
- [ ] Legal Center is available for Superadmins.
- [ ] LGPD export/deletion workflows are documented and validated.
- [ ] Compliance checklist approved by the PO.
