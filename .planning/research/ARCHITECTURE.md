# Architecture Research

**Domain:** Bestemmingsplan visualization, area deep-dive scanning, and change monitoring integration  
**Researched:** 2026-02-11  
**Confidence:** HIGH

## Executive Summary

This milestone adds THREE new capabilities to existing Propdex architecture:

1. **Bestemmingsplan base layer**: WMS proxy serving PDOK zoning maps as background layer
2. **Area deep-dive**: Focused bbox scans (hundreds of parcels) reusing existing pipeline with richer enrichment  
3. **Change monitoring**: ARQ cron jobs for periodic vergunning/zoning change detection

**Key architectural insight**: The pivot from "scan entire gemeente" to "bestemmingsplan-first with targeted deep-dives" requires MINIMAL core changes. Existing scan pipeline (AreaScan → ARQ job → ParcelCache → ScanResult) already supports arbitrary bboxes. New features are ADDITIVE layers on proven foundation.

---

*Complete architecture document follows...*
