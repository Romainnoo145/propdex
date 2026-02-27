# Phase 58: Workspace Productization - Research

**Researched:** 2026-02-27  
**Domain:** Workflow UX + product architecture  
**Confidence:** HIGH

---

## Summary

The platform already has broad data coverage and strong map/report primitives, but operability drops when scaling from a few municipalities to dozens.

The main risk is not missing data; it is cognitive overload and fragmented navigation. The app should now shift to a dedicated workspace model with clear scope progression:

`Provincie -> Gemeente -> Wijk -> Perceel -> Actie`

This sequence provides predictable context and supports high-volume users without losing speed.

---

## Core Findings

### 1) Scale pain is structural, not visual-only

- Municipality count and dataset size are growing fast.
- Flat tabs become harder to use as counts increase.
- Users need scoped workspaces more than additional standalone pages.

### 2) Monitoring must remain explicit

- Daily refresh jobs already exist but are tied to monitored projects/gemeenten.
- Auto-enabling every municipality is likely to overload external APIs and operations.
- Opt-in monitoring toggles per gemeente are the right control plane.

### 3) Map can become the execution surface

- Current map highlighting/popup model is already stronger than legacy slider flows.
- Globalizing one interaction path (parcel highlight + detail popup) across app entry points reduces confusion.

### 4) Multi-audience product direction should be staged

- Single codebase + persona modes is lower risk than cloning app now.
- Start with vastgoedontwikkelaar workspace because it aligns with current data model and sales intent.
- Borger/consumer overlays can layer on top once workspace architecture is stable.

---

## Recommended Phase Slices

1. 58-01 foundation: workspace persona context + role-aware shell hooks
2. 58-02 scope architecture: municipal workspace routing and shared top context bar
3. 58-03 operations UX: unified list behavior for rapporten/meldingen in scoped contexts
4. 58-04 map ops layer: parcel-layer strategy and click-first map workflow
5. 58-05 monetization rails: workflow outputs for professionals (pipeline-ready)

---

## Success Signal

Users can work end-to-end from municipality scope to actionable parcel decisions without losing context, while product remains extensible for future personas.
