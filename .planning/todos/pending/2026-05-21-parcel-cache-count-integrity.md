# Investigate: parcel_cache count integrity (inflated + mixed + cross-gemeente)

**Created:** 2026-05-21
**Type:** investigate (data-quality)
**Trigger:** Pitch claimed "137.000 percelen voor Venlo". Verification showed the number is wrong and the underlying data is mixed. Pitch fixed to coverage-language; root cause not yet fixed.

## Finding

`parcel_cache` for GM0983 (Venlo) = **125.621 rijen, 0 duplicaten**, maar het is geen 125k Venlo-percelen:

| Soort | Aantal |
|---|---|
| 14-cijferige kadaster-objecten | 63.817 |
| 16-cijferige BAG-objecten | 61.804 |
| — waarvan prefix 0983 (Venlo) | 54.774 |
| — waarvan prefix **0889 (buurgemeente)** | 6.988 |
| — waarvan 0893 / 1507 | 42 |

Plus een tweede gemeente GM1507 (11.524 rijen) staat los in parcel_cache.

**Officieel:** gemeente Venlo telt ~**31.531 kadastrale percelen** (22 secties; bron: Planviewer/Gemeentearchief Venlo, door user aangeleverd 2026-05-21). Onze kadaster-laag (63.817) is dus ~2× het officiële aantal.

## Vermoedelijke oorzaken (te verifiëren)

1. **Appartementsrechten**: een appartementencomplex = 1 perceel maar N kadastrale objecten → verklaart een deel van de 2×.
2. **Scan-buffer over de gemeentegrens**: de scan-bbox per wijk pakt percelen/objecten van buurgemeenten mee (verklaart de 0889/0893/1507-prefixes onder GM0983).
3. **Gemengde identifier-semantiek**: `parcel_id` bevat zowel BAG-objecten (16-cijferig) als BRK-kadaster-objecten (14-cijferig) door elkaar. Eén tabel, twee betekenissen.

## Impact

- "Per gemeente"-scoping en scan-cijfers zijn opgeblazen + bevat cross-gemeente data.
- Elke per-gemeente claim (pitch, dashboards, M049 data-hub) is onnauwkeurig.
- Relevant nu M052 "in productie" gaat (QUAL/multi-tenant per-gemeente correctheid).

## Onderzoeksvragen

1. Is de 2× kadaster-inflatie appartementsrechten, scan-buffer, of beide? (split de 63.817 op object-type)
2. Hoe lekt buurgemeente-data (0889 etc.) in GM0983? Scan-bbox zonder gemeentegrens-clip?
3. Moet parcel_cache gescoped/herlabeld worden naar echte Venlo kadastrale percelen, of is de BAG+BRK-mix bewust?
4. Reconcilieer identifier-semantiek: één `parcel_id` betekenis, of expliciet `bag_id` vs `brk_id`.

## Niet doen (nu)

Niet blind dedupliceren of rijen verwijderen — eerst begrijpen wat elk object-type is en of de scan-pipeline ze bewust ophaalt. Geen scope binnen huidige pitch-werk; aparte sessie.

---

## RESOLVED — attributie (2026-06-02)

Mis-stamping gefixt op prod via `app/tools/restamp_parcel_gemeente.py` (commit ba454b98).
Geen rijen verwijderd; alleen `gemeente_code` per-parcel hersteld vanuit de eigen
identiteit (BAG 16-cijferig → CBS-prefix; BRK 14-cijferig → kadastrale-gemeente-map).
16.020 rijen gecorrigeerd, alle kandidaat-rijen geback-upt naar
`parcel_cache_gemeente_backup_20260602` (omkeerbaar).

Eerlijke per-gemeente BRK-tellingen na fix:
- GM0983 Venlo = 55.034 (volledige gemeente: Venlo+Tegelen+Belfeld+Arcen; ~31.5k = kad.gem. Venlo-core)
- GM1507 Horst a/d Maas = 3.710 · GM1894 Peel en Maas = 2.764 · GM0889 Beesel = 2.236 · GM0893 Bergen = 73 (allemaal PARTIEEL — alleen scan-bleed)

Beantwoordt onderzoeksvraag 2 (cross-gemeente lek = scan-bbox stamp, nu hersteld op data-niveau).

## NOG OPEN (deferred)

1. **Root cause in scan-pipeline**: parcels krijgen nog steeds de gemeente_code van de SCAN bij nieuwe scans. Fix bij de regionale-dekking-milestone (assign gemeente per-parcel, niet per-scan).
2. **BAG/BRK identifier-semantiek** (onderzoeksvraag 4): één `parcel_id` bevat zowel BAG-objecten (16) als BRK-kadaster (14). Splitsen naar `bag_id`/`brk_id` of object_type-kolom — nog te doen.
3. **Appartementsrechten-split** (onderzoeksvraag 1): 55k BRK Venlo vs ~31.5k kad.gem-core — verschil = deelgemeenten + mogelijke A-rechten; niet uitgesplitst.
4. **Regionale dekking**: buurgemeenten staan PARTIEEL in data. Volledige gemeente-scans = aparte milestone (user-besluit 2026-06-02: "alles omliggend" als toekomstige scope, niet nu).
