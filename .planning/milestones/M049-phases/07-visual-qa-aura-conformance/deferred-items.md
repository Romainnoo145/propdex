# Deferred (pre-existing) — Phase 07

## TypeScript errors in unrelated files (out of scope)

- **Discovered during:** Plan 07-01 Task 1 (`npm run check`)
- **Pre-existing baseline:** 91 TS errors across 30+ unrelated files (rapporten.tsx, resultaten.tsx, verkenner.tsx, PortfolioBreadcrumb.tsx, WijkMapPanel.tsx, etc.)
- **Verified:** Stashed Task 1 change, re-ran `npm run check` → still 91 errors. Reapplied change → still 91. Plan 07-01 introduces ZERO new errors.
- **Reason deferred:** Pre-existing tech debt; this plan's scope is the gemeente-aware Link only. Plan 07-01 acceptance criterion `npm run check exits 0` is impossible without scoping a separate cleanup phase.
- **Recommendation:** Schedule a dedicated TS-strict-cleanup phase. Most errors trace to TanStack Router required `search` typing + framer-motion `Variants` type tightening — mechanical to fix.

## ~~S05 Type-C credential trigger never enabled after S05 ship~~ — RESOLVED in M049/S07.1 (commit `9c9819b5`)

- **Discovered during:** Plan 07-02 Task 1 (visual smoke capture)
- **Symptom:** `Configureer credential` buttons on all Type-C rows (`brk-eigendom`, `brk-hypotheken`, `brk-beslagen`, `nvm-transactiedata`, `vindsubsidies-database`) rendered with `[disabled]` + `reason_disabled="Beschikbaar vanaf S05"`.
- **Root cause:** `backend/app/admin/data_sources_helpers.py:50-62` hardcodes `Action(action="configure_credential", enabled=False, reason_disabled="Beschikbaar vanaf S05")` for `source_type == "C"`. Was meant to be flipped when S05 landed; the flip never happened.
- **Workaround used for Phase 7 evidence:** Temporarily edited `enabled=True` in a working-tree mutation (NOT committed) → captured `s05-credential-modal-empty.png` → reverted via `git checkout`. Backend tree is clean.
- **Fix scope:** Single-line change in `data_sources_helpers.py` (drop `reason_disabled`, flip to `enabled=True`). Trivial.
- **Recommendation:** Open a follow-up gap-closure phase (or a `M049/S07.1` slice) to flip the gate. Suggested commit: `M049/S07: flip configure_credential gate to enabled=True (post-S05 closure)`.

## ~~S05 CredentialConfigModal source_key mismatch~~ — RESOLVED in M049/S07.1 (commit `d96802b9`)

- **Discovered during:** Plan 07-02 Task 1 (after the trigger workaround above)
- **Symptom:** Modal opens for `brk-eigendom` but toast says **"Unknown source_key 'brk-eigendom'"** and form fields fail to render.
- **Root cause:** `backend/app/services/credential_fields.py:22-35` `CREDENTIAL_FIELDS` registry uses short generic keys (`brk`, `vindsubsidies`, `nvm`) while the catalog in `backend/app/services/data_source_keys.py` emits the long canonical kebab-case keys (`brk-eigendom`, `brk-hypotheken`, `brk-beslagen`, `nvm-transactiedata`, `vindsubsidies-database`). The modal's GET/POST round-trip to `/api/admin/integration-credentials/{source_key}` 422s because `source_key not in CREDENTIAL_FIELDS`.
- **Workaround used for Phase 7 evidence:** None — modal-open evidence is captured (`s05-credential-modal-empty.png` shows the header `Credential configureren · brk-eigendom` + Aura glass surface + amber lock icon). Three-state UX (#8 filled / #9 rotating / #10 empty-after-rotate) deferred — cannot render the form without resolving the key mismatch.
- **Fix scope:** Either (a) expand `CREDENTIAL_FIELDS` to key on long forms with aliases for the BRK family, or (b) add a short-key alias resolver in the router. Eng-review decision needed; (a) is closer to the M049 catalog-as-source-of-truth principle.
- **Recommendation:** Roll the resolution into the same follow-up phase as the trigger-gate fix.

## ~~S05 visual smokes #8 / #9 / #10~~ — CAPTURED in M049/S07.1

- `s05-credential-modal-filled.png` ✓ (FILLED state on api_key, `Geconfigureerd 2 uur geleden`, provider label resolved)
- `s05-credential-modal-rotating.png` ✓ (DELETE in flight)
- `s05-credential-modal-empty-after-rotate.png` ✓ (form re-rendered empty + `Credential verwijderd` toast)
- `s05-credential-modal-empty.png` (captured in Phase 7) — modal opens, Aura tokens render, "Versleuteld opgeslagen (Fernet, vendor-managed)" subtitle wired
