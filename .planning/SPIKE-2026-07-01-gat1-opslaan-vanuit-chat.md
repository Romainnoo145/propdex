# Spike — Gat 1: opslaan vanuit de chat (parcel_code zonder BRK)

**Datum:** 2026-07-01
**Vraag:** Kunnen we betrouwbaar een stabiele `parcel_code` krijgen om `create_favorite` te voeden, zónder BRK Bevragen (staat UIT op prod)?
**Uitkomst:** ✅ **GO** — geen BRK nodig.

---

## Bevindingen (geverifieerd tegen prod-DB, read-only)

### 1. `parcel_cache` bevat de stabiele sleutel
- Venlo (GM0983): **125.621** `parcel_cache`-rijen, waarvan **63.796** met een `parcel_code`.
- Elke rij heeft zowel `parcel_id` (bv. `37560608470000`) als `parcel_code` (bv. `Venlo M 6084`).
- `parcel_cache` wordt gevuld door **scans** (area_scan), niet door BRK.

### 2. Adres → perceel resolven werkt zonder BRK
`app/scans/parcels_service.py::resolve_parcel_by_address(street, huisnummer, postcode)`
(de route die `map.tsx` gebruikt via `GET /api/scans/parcels/resolve`):
- Leest **uitsluitend** bestaande `parcel_cache`-rijen (address-contains + PDOK-geocode → `find_parcel_at_point`).
- Geen BRK-call, geen write/upsert.
- Test: `resolve_parcel_by_address("Venrayseweg", 192)` →
  `{parcel_id: <ParcelCache-UUID>, address: "Venrayseweg 192, 5928RH Venlo", lng, lat}`.
- Die UUID → `parcel_code='Venlo X 613'`, `gemeente_code='GM0983'`.

### 3. Wat `create_favorite` nodig heeft
`app/favorites/favorites_service.py::_resolve_favorite_context` matcht op
`ParcelCache.parcel_id == parcel_id OR ParcelCache.parcel_code == parcel_id`.
Dus de string die je aan `create_favorite` meegeeft moet gelijk zijn aan een
bestaande `parcel_cache.parcel_code` (of `.parcel_id`). Beide komen uit stap 2.

### 4. `kadastrale_aanduiding` is NIET de sleutel
`aggregate_property_data().cadastral_parcels[].kadastrale_aanduiding` gebruikt de map
alleen als **display-fallback** wanneer een perceel in géén scan zit
(`map.tsx:1108`). De stabiele sleutel is `parcel_cache.parcel_code`, gevuld door scans.

---

## Correctie op het plan
De plan-stap "resolve → **parcel_cache upsert** → create_favorite" bevat een
onnodige upsert. `resolve_parcel_by_address` slaagt alléén wanneer de rij al
bestaat en geeft die UUID terug. `POST /api/favorites/from-address` hoeft dus
enkel:
1. `resolve_parcel_by_address(street, huisnummer, postcode)` → ParcelCache-UUID (+ lng/lat)
2. Lees `parcel_code`, `gemeente_code` uit die rij
3. `create_favorite(parcel_code, gemeente_code, gemeente_naam, wijk_naam, address, user_id, db)`

## Randvoorwaarde / bekend risico
- Werkt voor percelen die **al in `parcel_cache`** zitten (gescande gebieden).
  Venlo is gescand → demo-scope gedekt. Ongescande percelen → `resolve` 404't
  (geen BRK-fallback). Dit is acceptabel voor de verkenner-demo.
