# Global COA Alignment

**One place to design, debate, approve and map a new global standard chart of accounts for SAP S/4HANA.**

> Demo company: **JIB Industrial Auto Supply (Fictional)**. All companies, people and figures in this project are invented.

## The problem

Rolling out one global chart of accounts across 200+ legal entities is mostly a people problem. Every entity, region and function has a view. When the work runs on Excel files, email threads and several disconnected tools, you lose track of:

- which version of an account is current
- who agreed, who objected, and why
- which local "must-have" accounts are really reporting dimensions in disguise
- how thousands of legacy accounts map to the new chart

This app keeps all of that in one workflow with a full audit trail.

## What it does (MVP scope)

| Capability | Description |
|---|---|
| **Alignment dashboard** | Wave 1: 30 of 214 entities. Approval progress, entity adoption by region, open objections, approver bottlenecks, legacy-to-global account reduction |
| **Approval inbox & audit trail** | Tiered workflow: Entity Analyst → Regional Controller → Global Accounting Head, with every decision logged |
| **Entity fit-check votes** | Each entity marks every proposed account *Fits / Needs change / Can't use* |
| **Local extension requests** | Formal requests for country accounts, automatically screened with "is this an account or a dimension?" |
| **Formal objections** | Blocking issues that must be resolved before final approval |
| **Legacy mapping** | 1:1, N:1 and 1:N mappings from three legacy ERPs, with S/4 attribute-conflict checks |
| **S/4HANA export** | Load-ready files for the approved chart |

## SAP S/4HANA design assumptions

- One **global operational chart of accounts** plus **country (alternative) charts** for statutory reporting
- **8-digit, range-based numbering**: 1 assets · 2 liabilities · 3 equity · 4 revenue · 5–7 cost of sales / opex · 8 other · 9 secondary cost / statistical
- Universal Journal aware: cost elements are G/L accounts, so Controlling is in scope
- US GAAP leading ledger; IFRS and local GAAP as parallel ledgers
- Post-go-live change governance is out of scope. That is the job of SAP MDG-F.

## Tech stack

- Static front end (HTML/JS, no build step), hosted on **Vercel**
- **Supabase** (Postgres) for shared data, with a nightly demo reset
- Rule-based "smart checks", each designed to be swapped for a Claude API call later

## Status

🚧 In active development. See [`docs/requirements.md`](docs/requirements.md).

---
Built by Jay Blandford with Claude.
