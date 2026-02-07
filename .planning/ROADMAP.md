# CRM Plus — Roadmap

## Overview

Milestone 1 delivers the Core Intelligence Engine: enter any Dutch address and receive instant property intelligence reports with kadaster data, zoning rules, monument status, and AI-powered bestemmingsplan parsing. This MVP proves the speed value proposition — compressing 3-6 weeks of manual due diligence into 3-minute structured reports.

**Phases:** 5
**Depth:** Standard
**Coverage:** 14/14 Milestone 1 requirements mapped

---

## Phase 1: Foundation & Authentication

**Goal:** Users can securely access the platform with multi-tenant data isolation

**Dependencies:** None

**Requirements:** INFRA-01, INFRA-02

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, DB models, Alembic migrations, RLS policies
- [x] 01-02-PLAN.md — Core auth endpoints (register, login, refresh, logout, me) + tenant middleware
- [x] 01-03-PLAN.md — Email verification, password reset, Google OAuth, rate limiting

**Success Criteria:**
1. User can create an account and log in with email/password
2. User stays logged in across browser sessions
3. User can log out from any page
4. All database queries automatically filter by organization_id
5. No data leakage between organizations is possible

**Status:** Complete

---

## Phase 2: Core Data Pipeline

**Goal:** System can fetch and aggregate Dutch government property data in parallel

**Dependencies:** Phase 1 (requires authentication and multi-tenant foundation)

**Requirements:** PROP-01, PROP-02, INFRA-03

**Success Criteria:**
1. User can enter a Dutch address and trigger property lookup
2. System fetches kadaster data (ownership, transactions, boundaries, surface area) from PDOK/Kadaster APIs
3. Multiple government APIs are called in parallel (not sequentially)
4. API responses are cached with appropriate TTLs to avoid redundant calls
5. Report displays kadaster data with clear data source attribution
6. Cached data shows staleness indicators (e.g., "Updated 2 hours ago")

**Status:** Pending

---

## Phase 3: Zoning & Monument Intelligence

**Goal:** Reports include bestemmingsplan summary and monument/heritage status

**Dependencies:** Phase 2 (requires core data pipeline working)

**Requirements:** PROP-03, PROP-04, PROP-06

**Success Criteria:**
1. Report includes bestemmingsplan summary (permitted functions, max height, density, parking requirements)
2. Report includes monument status (rijksmonument, gemeentelijk monument, or none)
3. Monument status is checked from multiple sources (RCE, BAG, Kadaster) and conflicts are flagged
4. Each data field shows its source (API vs AI-parsed) with confidence indicator
5. Heritage restrictions are displayed in plain language for monument properties
6. User can view property location on interactive map with PDOK tile layers

**Status:** Pending

---

## Phase 4: AI Document Parsing

**Goal:** System extracts zoning rules from PDF bestemmingsplannen when API data is insufficient

**Dependencies:** Phase 3 (requires basic intelligence report working)

**Requirements:** PROP-05, INFRA-04

**Success Criteria:**
1. System downloads bestemmingsplan PDF when structured API data is unavailable
2. AI parsing runs asynchronously in background (user sees progress, not timeout)
3. User can see job status while AI processes document
4. Extracted zoning rules are structured and displayed with confidence scores (LOW/MEDIUM/HIGH)
5. AI-parsed data includes disclaimers ("Verify with notaris" for ambiguous interpretations)
6. PDF parsing detects complex structures (tables, footnotes) and flags incompleteness

**Status:** Pending

---

## Phase 5: Report Management

**Goal:** Users can save, list, and revisit property intelligence reports

**Dependencies:** Phase 3 (requires complete reports to save)

**Requirements:** RPT-01, RPT-02, RPT-03

**Success Criteria:**
1. User can save a property intelligence report for later reference
2. User can view a list of all saved reports (filtered by their organization)
3. User can re-open a saved report and see full details
4. Saved reports show when they were generated and last updated
5. User can delete saved reports they no longer need

**Status:** Pending

---

## Progress

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 1 - Foundation & Authentication | Users can securely access platform | INFRA-01, INFRA-02 | Complete |
| 2 - Core Data Pipeline | Fetch and aggregate government property data | PROP-01, PROP-02, INFRA-03 | Pending |
| 3 - Zoning & Monument Intelligence | Reports include bestemmingsplan and monument status | PROP-03, PROP-04, PROP-06 | Pending |
| 4 - AI Document Parsing | Extract zoning rules from PDF bestemmingsplannen | PROP-05, INFRA-04 | Pending |
| 5 - Report Management | Save, list, and revisit reports | RPT-01, RPT-02, RPT-03 | Pending |

**Current Phase:** 2
**Completed:** 1/5
**Coverage:** 14/14 requirements mapped

---

*Last updated: 2026-02-07*
