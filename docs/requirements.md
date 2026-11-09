# Global COA Alignment App — Requirements v0.2
*Captured 2026-11-09 from the initial brief, research and stakeholder interview.*

## 1. Purpose
A public portfolio demo of one central app to capture, debate, approve and map a new **global standard chart of accounts** for a multinational on **SAP S/4HANA**. It replaces the "Excel + email + multiple tools" approach.

## 2. Fictional company
- **JIB Industrial Auto Supply (Fictional)**: an industrial / auto-supply conglomerate.
- **US GAAP leading ledger**; IFRS and local statutory as parallel ledgers / country charts.
- **Scale:** a 214-legal-entity program. Seed data is **Wave 1: 30 of 214 entities**. The data model and UI must not assume a small number.
- **Legacy landscape:** three legacy systems, each with its own chart:
  - SAP ECC (Americas / Europe core)
  - Oracle EBS (acquired US businesses)
  - Local ERPs (Asia / LatAm)

## 3. SAP design assumptions
- One **global operational chart of accounts** + **country (alternative) charts** for statutory needs.
- **8-digit, range-based numbering:** 1 assets · 2 liabilities · 3 equity · 4 revenue · 5–7 cost of sales / opex · 8 other income/expense · 9 secondary cost / statistical.
- Universal Journal: cost elements are G/L accounts (primary / secondary cost type), so Controlling is in scope.
- Attributes tracked: account type, reconciliation account type, open item management, line item display, tax category, field status group, currency, functional area, group account / FS item.

## 4. Scope
**In:** design capture → stakeholder feedback → tiered approval → legacy-to-global mapping → S/4 load-file export.
**Out:** post-go-live change governance (SAP MDG-F).

## 5. Roles (one-click role picker, no signup)
| Role | Can do |
|---|---|
| Entity Accounting Analyst | Fit-check votes, local extension requests, formal objections |
| Regional Controller (Americas / EMEA / APAC) | Review & recommend, resolve entity objections in region |
| Global Accounting Head | Final approve / reject, override, publish chart versions |

Specialist roles (Tax, FP&A, Treasury, SAP/IT, Audit) are deferred; the model must allow adding them.

## 6. Workflow
Proposed → Regional review → Global Head decision → Approved / Rejected / Returned. Every action is written to an immutable audit trail (who, what, when, before/after, rationale).

## 7. Feedback mechanisms
1. **Entity fit-check votes:** *Fits / Needs change / Can't use*, with a reason. These drive adoption % per account and per entity.
2. **Local extension requests:** screened by rules for "dimension, not account" (region, product, customer, department, cost center), duplicates, and statutory justification.
3. **Formal objections:** blocking until resolved.

## 8. Smart checks (rule-based, AI-ready)
- Account-vs-dimension detector
- Duplicate / near-duplicate names
- Number range vs. account type
- Mapping conflicts: N:1 merges that mix open-item / non-open-item or reconciliation / non-reconciliation accounts; 1:N splits flagged

## 9. Priority screens
1. **Alignment dashboard**
2. **Approval inbox & audit trail**

Supporting: account catalog, mapping workbench, export.

## 10. Tech & delivery
- Static front end on **Vercel**, **Supabase** Postgres (free tier), nightly demo reset.
- Target: MVP live in about a week.
