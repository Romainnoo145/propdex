# Bodemloket ArcGIS REST Spike — Phase 68

**Date:** 2026-03-02
**Confidence:** HIGH (live test against confirmed WBB polygon geometry)

## RD Coordinates Used

### Primary: propdex DB parcel (Venlo)
x: 208888, y: 378594
Source: propdex DB — parcel_cache table, address "Genooyerweg 94, 5914HA Venlo"
Result: 0 features at both ±10m and ±25m — normal for clean/unregistered parcel

### Secondary: National scan to find live WBB features
National bounding box query (xmin=7000,ymin=289000,xmax=300000,ymax=629000) returned 5 features.
First feature: WBB_DOSSIER_DBK=17892511, Schiermonnikoog.

### Tertiary: Exact WBB polygon centroid (for buffer comparison)
x: 206259, y: 610965
Source: Retrieved via WHERE clause query on OID 17892511, geometry in EPSG:28992 (outSR=28992)
Polygon actual dimensions: ~27m x 25m (x=[206248,206275], y=[206955,610980])

## Buffer Test Results

### At Venlo parcel centroid (x=208888, y=378594)
±10m: HTTP 200, 0 features
±25m: HTTP 200, 0 features

### At confirmed WBB polygon centroid (x=206259, y=610965, Schiermonnikoog)
±10m: HTTP 200, **1 feature** (WBB_DOSSIER_DBK=17892511)
±25m: HTTP 200, **2 features** (17892511 + 17892535 from adjacent polygon)

### Buffer Decision
**Use ±10m**

Rationale: The ±10m buffer returned 1 feature (the polygon directly containing/intersecting
the centroid). The ±25m buffer returned 2 features — the second feature (OID 17892535)
belongs to an adjacent WBB polygon ~25m away. For urban parcel lookups, a 25m buffer
extends significantly into neighboring land parcels. A 10m buffer is sufficient to reliably
hit the WBB polygon when querying from a parcel centroid (polygon dimensions are typically
10-50m). The ±10m buffer minimizes false-positives from adjacent contaminated parcels.

Note: The confirmed polygon here was ~27m x 25m — both buffers work for this case.
But for dense urban environments with adjacent parcels, ±10m is tighter and more precise.

## Confirmed Live Response (±10m at WBB polygon centroid)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "properties": {
        "WBB_DOSSIER_DBK": 17892511,
        "SIKB_ID": "0206060720071119121106654",
        "TYPE_CD": "20",
        "VERVOLG_WBB": "voldoende onderzocht",
        "STATUSVER": null,
        "STATUS_OORD": "niet ernstig, licht tot matig verontreinigd",
        "ADMINISTRATOR_NM": "Schiermonnikoog",
        "LOCATIECODE_BEVOEGD_GEZAG": "FR008800079",
        "BIS_LOCCODE": "NZ060600001"
      }
    }
  ]
}
```

Second feature from ±25m (adjacent polygon — filtered out by tighter ±10m):
```json
{
  "WBB_DOSSIER_DBK": 17892535,
  "SIKB_ID": "0200880020071119121157056",
  "TYPE_CD": "20",
  "VERVOLG_WBB": "voldoende onderzocht",
  "STATUSVER": null,
  "STATUS_OORD": "niet ernstig, plaatselijk sterk verontreinigd",
  "ADMINISTRATOR_NM": "Schiermonnikoog",
  "LOCATIECODE_BEVOEGD_GEZAG": "FR008800069",
  "BIS_LOCCODE": "NZ008800004"
}
```

Clean parcel (Venlo, Genooyerweg 94):
```json
{ "type": "FeatureCollection", "features": [] }
```

## Confirmed Field Names (from live response)

All fields from RESEARCH.md confirmed present in actual response:

| Field | Type | Example Value | Notes |
|-------|------|---------------|-------|
| WBB_DOSSIER_DBK | esriFieldTypeOID (int) | 17892511 | Primary key, always present |
| SIKB_ID | esriFieldTypeString | "0206060720071119121106654" | SIKB reference number |
| TYPE_CD | esriFieldTypeString | "20" | Contamination type code |
| VERVOLG_WBB | esriFieldTypeString | "voldoende onderzocht" | Follow-up status |
| STATUSVER | esriFieldTypeString | null | Sanering status, often null |
| STATUS_OORD | esriFieldTypeString | "niet ernstig, licht tot matig verontreinigd" | Contamination verdict |
| ADMINISTRATOR_NM | esriFieldTypeString | "Schiermonnikoog" | Competent authority |
| LOCATIECODE_BEVOEGD_GEZAG | esriFieldTypeString | "FR008800079" | Authority location code |
| BIS_LOCCODE | esriFieldTypeString | "NZ060600001" | BIS location code |

## API Behavior Notes

1. **f=geojson with inSR=28992:** Geometry is returned as WGS84 (lat/lon) despite inSR. Properties are correct.
2. **f=json with outSR=28992:** Returns ArcGIS JSON format with ring coordinates in EPSG:28992 (correct).
3. **National extent query works:** The layer extent metadata has unrealistic coordinates but spatial queries with correct RD bbox work correctly.
4. **RESEARCH.md coordinates (x=118150, y=583400):** These appear to be approximate/rounded — features are at x=206259, y=610965 (same Schiermonnikoog area). The actual feature centroids differ from the research coordinates. The research may have used WGS84 approximate coords converted incorrectly.

## Deviations from RESEARCH.md

**None in field names or URL.** One deviation in coordinates:
- RESEARCH.md used x=118150, y=583400 as "Schiermonnikoog area" test coordinates
- Live geometry retrieval shows WBB polygon centroid at x=206259, y=610965
- The RESEARCH.md coordinates (118150, 583400) may be outside the actual polygon cluster
- Impact: None — field names, URL, and response format are all confirmed correct

**Buffer decision change:**
- RESEARCH.md recommended ±25m as default
- Spike result: ±25m returns adjacent polygon; ±10m returns only the directly intersecting polygon
- Decision: Use ±10m (more precise, fewer false-positives from adjacent parcels)

## Plan 68-02 Constants

```python
BASE_URL = "https://gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer/0/query"
BUFFER_M = 10
DISCLAIMER = "Bodemloket bevat niet alle locaties in Nederland. Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."
```

## Methodology Notes

1. Queried propdex parcel_cache for real Dutch address with geometry (Genooyerweg 94, Venlo)
2. Tested Venlo address at ±10m and ±25m — confirmed 0 features (normal for clean parcels)
3. Ran national bounding box query to find live WBB features in the database
4. Retrieved exact geometry of WBB polygon OID 17892511 in EPSG:28992 via outSR=28992
5. Used confirmed polygon centroid (x=206259, y=610965) for precise buffer comparison
6. ±10m → 1 feature (direct intersection), ±25m → 2 features (includes adjacent polygon)
7. Decision: ±10m is the better choice for parcel-level queries
