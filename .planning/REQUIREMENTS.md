# Requirements: Propdex v6.0 -- Meldingen Intelligence

**Defined:** 2026-02-23
**Core Value:** Area -> Opportunity Intelligence -- make meldingen actionable with reliable parcel matching, direct map→rapport flow, and proper read tracking

## v6.0 Requirements

Transform the meldingen (change monitoring) system from a passive notification feed into an actionable intelligence tool. Fix broken parcel matching, enable direct melding→map→rapport flow, add server-side per-change read tracking, and improve the overall meldingen UX.

### Parcel Matching

- [ ] **MATCH-01**: System geocodes bekendmaking addresses via PDOK Locatieserver to get coordinates when no parcel match exists
- [ ] **MATCH-02**: Matched parcel IDs are stored persistently on ChangeRecord for direct navigation (not computed on-demand only)
- [ ] **MATCH-03**: Matching re-runs retrospectively when new scans complete (existing unmatched changes get checked against new ParcelCache entries)

### Flow

- [ ] **FLOW-01**: User can click a matched parcel in a melding to fly to that location on the map
- [ ] **FLOW-02**: Map shows an amber marker at the parcel location with address and "Genereer rapport" button
- [ ] **FLOW-03**: User can generate a report from the map marker using verified parcel data
- [ ] **FLOW-04**: Wijk project hierarchy is auto-created when generating a report for an unlinked parcel

### Address Intelligence

- [ ] **ADDR-01**: Address extraction handles all common Dutch SRU bekendmaking title formats (with test coverage on real examples)
- [ ] **ADDR-02**: Extracted addresses include both postcode and huisnummer for precise parcel matching
- [ ] **ADDR-03**: Changes display human-readable category labels (e.g., "Omgevingsvergunning aangevraagd", "Bestemmingsplan gewijzigd")

### Read Tracking

- [ ] **READ-01**: User can mark individual changes as read/unread (click-to-toggle)
- [ ] **READ-02**: Read state is persisted server-side in database (works across browsers and devices)
- [ ] **READ-03**: Unread count badges reflect per-change read state (not project-level timestamp)
- [ ] **READ-04**: User can "mark all as read" for all visible changes in one action

### Meldingen UX

- [ ] **UX-01**: Meldingen page supports filtering by gemeente
- [ ] **UX-02**: Each melding shows clear action state -- matched = rapport button, unmatched = kaart-only or "geen match"
- [ ] **UX-03**: Read-tracking logic extracted to shared hook used by both meldingen.tsx and ChangeTimeline.tsx
- [ ] **UX-04**: Meldingen feed handles growth with pagination or infinite scroll

## Future Requirements

Deferred to v6.1+. Tracked but not in current roadmap.

### Search & Filtering
- **SEARCH-01**: Full-text search across bekendmaking titles and addresses
- **SEARCH-02**: Date range filtering on meldingen feed
- **SEARCH-03**: Filter by change type (permit / zoning / all)

### Notifications
- **NOTIF-01**: Email digest of new meldingen (daily/weekly configurable)
- **NOTIF-02**: Webhook integration for external notification (Slack, Teams)

### Export
- **EXPORT-01**: Export filtered meldingen to CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| ML-based address extraction | Regex patterns with PDOK validation sufficient for Dutch addresses |
| Real-time WebSocket notifications | Polling at 60s is adequate for daily change detection |
| Historical bekendmakingen backfill (>30 days) | SRU API rate limits make large backfills impractical |
| Zoning change visual diff | Requires WMS tile comparison infrastructure |
| Melding → auto-generate rapport (no user action) | Reports should be user-initiated for cost control |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADDR-01 | Phase 47 | Pending |
| ADDR-02 | Phase 47 | Pending |
| ADDR-03 | Phase 47 | Pending |
| MATCH-01 | Phase 48 | Pending |
| MATCH-02 | Phase 48 | Pending |
| MATCH-03 | Phase 48 | Pending |
| READ-01 | Phase 49 | Pending |
| READ-02 | Phase 49 | Pending |
| READ-03 | Phase 49 | Pending |
| READ-04 | Phase 49 | Pending |
| FLOW-01 | Phase 50 | Pending |
| FLOW-02 | Phase 50 | Pending |
| FLOW-03 | Phase 50 | Pending |
| FLOW-04 | Phase 50 | Pending |
| UX-01 | Phase 51 | Pending |
| UX-02 | Phase 51 | Pending |
| UX-03 | Phase 51 | Pending |
| UX-04 | Phase 51 | Pending |

**Coverage:**
- v6.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0
- Complete: 0 (0%)

---
*Requirements defined: 2026-02-23*
*Traceability updated: 2026-02-23 -- all 18 requirements mapped to Phases 47-51*
