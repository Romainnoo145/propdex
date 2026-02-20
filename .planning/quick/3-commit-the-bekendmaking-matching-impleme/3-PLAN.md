---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/alembic/versions/c3d4e5f6a7b8_add_postcode_to_change_records.py
  - backend/app/services/postcode_extractor.py
  - backend/app/services/bekendmaking_matcher.py
  - backend/app/models/change_record.py
  - backend/app/services/change_detector.py
  - backend/app/jobs/change_monitor.py
  - backend/app/schemas/monitoring.py
  - backend/app/monitoring/router.py
  - frontend/src/lib/types/monitoring.ts
  - frontend/src/lib/api.ts
  - frontend/src/hooks/useNotifications.ts
  - frontend/src/components/notifications/ChangeTimeline.tsx
  - frontend/src/components/results/ParcelDetailModal.tsx
  - frontend/src/routes/_authenticated/resultaten.tsx
autonomous: true
must_haves:
  truths:
    - "Bekendmaking matching implementation is committed to git"
    - "Only bekendmaking-specific files are included in the commit"
    - "Unrelated v4.0/v5.0 changes remain unstaged"
  artifacts:
    - path: "backend/app/services/bekendmaking_matcher.py"
      provides: "Matching service committed"
    - path: "backend/app/services/postcode_extractor.py"
      provides: "Postcode extractor committed"
    - path: "backend/alembic/versions/c3d4e5f6a7b8_add_postcode_to_change_records.py"
      provides: "Migration committed"
  key_links: []
---

<objective>
Commit the bekendmaking matching implementation as a clean, scoped commit containing only the files related to this feature.

Purpose: The implementation is complete and verified (ruff + npm run check pass, migration ran). It needs a proper git commit before further work proceeds.
Output: One git commit containing the 14 bekendmaking-specific files.
</objective>

<execution_context>
@/home/klarifai/.claude/get-shit-done/workflows/execute-plan.md
@/home/klarifai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/PROJECT.md
@/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stage bekendmaking files and commit</name>
  <files>
    backend/alembic/versions/c3d4e5f6a7b8_add_postcode_to_change_records.py
    backend/app/services/postcode_extractor.py
    backend/app/services/bekendmaking_matcher.py
    backend/app/models/change_record.py
    backend/app/services/change_detector.py
    backend/app/jobs/change_monitor.py
    backend/app/schemas/monitoring.py
    backend/app/monitoring/router.py
    frontend/src/lib/types/monitoring.ts
    frontend/src/lib/api.ts
    frontend/src/hooks/useNotifications.ts
    frontend/src/components/notifications/ChangeTimeline.tsx
    frontend/src/components/results/ParcelDetailModal.tsx
    frontend/src/routes/_authenticated/resultaten.tsx
  </files>
  <action>
    Stage only the bekendmaking-specific files by name (NOT git add -A or git add .). The working tree contains many unrelated modified files from v4.0/v5.0 work — those must remain unstaged.

    Files to stage (run git add for each):
    - backend/alembic/versions/c3d4e5f6a7b8_add_postcode_to_change_records.py (new — migration)
    - backend/app/services/postcode_extractor.py (new — Dutch postcode regex extraction)
    - backend/app/services/bekendmaking_matcher.py (new — matching service)
    - backend/app/models/change_record.py (modified — added postcode column)
    - backend/app/services/change_detector.py (modified — extract postcode during detection)
    - backend/app/jobs/change_monitor.py (modified — fixed description bug, copy postcode + source_url)
    - backend/app/schemas/monitoring.py (modified — added MatchedParcel, MatchedReport schemas)
    - backend/app/monitoring/router.py (modified — enhanced /changes endpoint, new /changes-for-parcel)
    - frontend/src/lib/types/monitoring.ts (modified — added match types)
    - frontend/src/lib/api.ts (modified — added fetchChangesForParcel)
    - frontend/src/hooks/useNotifications.ts (modified — added useParcelChanges hook)
    - frontend/src/components/notifications/ChangeTimeline.tsx (modified — match pills + navigation links)
    - frontend/src/components/results/ParcelDetailModal.tsx (modified — Meldingen section)
    - frontend/src/routes/_authenticated/resultaten.tsx (modified — added highlight search param)

    Then create a commit with message:
    "feat: add bekendmaking matching to parcels and reports

    - Extract Dutch postcodes from bekendmaking descriptions via regex
    - Match bekendmakingen to parcels by postcode proximity
    - Match bekendmakingen to reports by parcel overlap
    - Add /changes-for-parcel endpoint for parcel-specific changes
    - Show Meldingen section in ParcelDetailModal with timeline
    - Add match pills and navigation links in ChangeTimeline
    - Migrate change_records table to include postcode column"
  </action>
  <verify>
    Run: git log --oneline -3
    Expected: The new commit appears at the top with the bekendmaking message.

    Run: git show --stat HEAD
    Expected: Shows exactly 14 files (3 new + 11 modified), all bekendmaking-related. No unrelated files (e.g., bag_api.py, ResultsFilterPanel.tsx, map.tsx) appear.

    Run: git status --short
    Expected: The 14 committed files no longer appear as modified/untracked. The other unrelated files remain listed as modified.
  </verify>
  <done>
    Git log shows the bekendmaking commit at HEAD. git show --stat HEAD lists exactly the 14 bekendmaking files and no others. All checks (ruff + npm run check) remain passing.
  </done>
</task>

</tasks>

<verification>
- git log --oneline -1 shows bekendmaking feat commit
- git show --stat HEAD lists exactly 14 files
- git status still shows unrelated files as unstaged (they were not swept in)
</verification>

<success_criteria>
One clean, scoped commit on main containing only the 14 bekendmaking matching files. Zero unrelated files included.
</success_criteria>

<output>
No SUMMARY.md needed — this is a quick commit task with no planning artifacts to record.
</output>
