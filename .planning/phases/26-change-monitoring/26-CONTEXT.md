# Phase 26: Change Monitoring - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Monitor watched areas for new building permits (omgevingsvergunningen) and zoning changes (bestemmingsplannen). Daily automated checks via SRU Bekendmakingen and PDOK PLU WMS. Changes surface as in-app notifications tied to auto-created project folders, with compact change history per wijk.

</domain>

<decisions>
## Implementation Decisions

### Saving areas to watch
- Every wijk scan auto-creates a project folder (no manual save step)
- Hierarchical project structure: Gemeente group containing Wijk projects (e.g., "Venlo" group with "Blerick-Zuid", "Tegelen" as sub-projects)
- Scanned wijken get a filled semi-transparent overlay on the map indicating they're being monitored
- Change monitoring is tied to the project system — changes appear as a changelog inside the wijk's project folder

### Notification experience
- Dual notification: badge/dot on the project folder in Projecten tab AND a notification icon with count badge in the side navigation rail
- Notifications cleared automatically when user opens/views the project folder or change detail (no manual dismiss)
- Side-rail notification icon click navigates to Projecten tab with changed projects highlighted
- In-app notifications only — no email notifications

### Change types
- Both permits (omgevingsvergunningen) and bestemmingsplan changes are equally important
- No filtering UI needed — show all change types together, differentiated by icon/color
- Daily automated checks only — no manual rescan button
- No filter tabs — volume expected to be manageable per wijk

### Claude's Discretion
- Change history layout: timeline vs table/list (pick what fits existing UI patterns)
- Change entry detail level: compact with expand (date, address, type icon — click for details)
- Change grouping: by date vs by address (pick what makes sense for scanning)
- Map linking: whether clicking a change entry flies to the affected parcel on the map
- History depth: rolling window vs full history (consider storage and performance)

</decisions>

<specifics>
## Specific Ideas

- "Scanned wijken should be marked on the map" — filled overlay to show monitored status
- "Auto-create project folders based on scanned wijken" — no manual save/bookmark step
- "Onderverdeling in stad" — hierarchical grouping where wijken are nested under their gemeente
- "A sign that something has updated in the specific project folder, then we see which address" — badge on folder + address-level change detail
- Changes live as a changelog inside project folders, not as a separate monitoring section

</specifics>

<deferred>
## Deferred Ideas

- Email digest notifications — noted for future enhancement
- Manual rescan/on-demand change check — not needed now, daily sufficient

</deferred>

---

*Phase: 26-change-monitoring*
*Context gathered: 2026-02-15*
