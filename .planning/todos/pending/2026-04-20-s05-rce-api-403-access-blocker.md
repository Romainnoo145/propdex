# TODO: RCE API access blocker — api.rijksmonumenten.info 403

**Captured:** 2026-04-20 tijdens M046/S05 T07 verificatie
**Severity:** BLOCKER voor S05 waarde-realisatie (30-40% bug fix werkt niet in prod)
**Not a blocker for merging:** S05 plumbing + graceful-degradation werkt correct

## Probleem

`api.rijksmonumenten.info/select/` retourneert HTTP 403 "You do not have permission
to view this directory or page." voor alle requests — ongeacht User-Agent
(`Mozilla/5.0`, `curl/7.81`, `python-requests`, empty). Bewijs:

```bash
$ curl https://api.rijksmonumenten.info/select/
<HTML>You do not have permission to view this directory or page.</HTML>
```

De S05-implementatie werkt correct — RCE-client faalt met `GovernmentAPIError`,
`_fetch_rijksmonument` in scan_enrichment vangt dit, retourneert `None`,
`score_monument` valt terug op legacy keyword-match. Functional code path ✓,
**feature benefit = 0** tot API toegankelijk is.

## Alternatieven onderzocht (2026-04-20)

| Endpoint | Status | Notes |
|---|---|---|
| `api.rijksmonumenten.info/select/` | 403 | Solr geofilt (huidige client) |
| `service.pdok.nl/rce/rijksmonumenten/wfs/v1_0` | 404 | Niet bestaand |
| `service.pdok.nl/cultureelerfgoed/rijksmonumenten/wfs/v1_0` | 404 | Niet bestaand |
| `service.pdok.nl/rce/beschermde-gebieden/wfs/v1_0` | 404 | Niet bestaand |
| `data.cultureelerfgoed.nl/rce/rijksmonumenten/wfs/v1_0` | 303 → PoolParty auth wall | Linked Data SPARQL endpoint, vereist account |

## Mogelijke oplossingen

1. **Contact RCE / data.cultureelerfgoed.nl** — vraag API-access aan
   via info@cultureelerfgoed.nl. Misschien is er een sleutel of IP-whitelist
   nodig die we kunnen aanvragen.
2. **Register voor PoolParty SPARQL** — account aanmaken op
   `data.cultureelerfgoed.nl`, SPARQL-credentials verkrijgen, `rce_linked_data.py`
   uitbreiden (bestaat al met `rce_linked_data_client`!) om bevoegde queries
   te doen. SPARQL is complexer dan Solr maar gov-gesupport.
3. **Alternatieve data** — BAG bevat soms monument-flags
   (`status == 'Monument ...'`). Kadaster Basisregistratie heeft
   zakelijkerechten-data. Beide minder compleet dan RCE-register.
4. **Dataset download + local ETL** — RCE publiceert open-data dumps
   (CSV/GeoJSON) op opendata.cbs.nl. Periodieke import in eigen DB.
   Geen runtime API-call, minder up-to-date maar 100% beschikbaar.

**Aanbeveling:** start met (1) — simpelste. Fallback (4) als access te lang
duurt (backups via gestaagde CSV-import, elke nacht).

## Impact op M046 claim

M046 belooft: *"elke factor in Score v3.0 defensibly correct of gemarkeerd
'beperkte data'"*. Met deze blocker:
- `score_monument` in de fallback-path markeert `missing=True` ✓
- Frontend M046/S06 expanded view toont "RCE-data was niet beschikbaar
  tijdens deze scan" ✓
- Gebruikers zien dus een eerlijk signaal dat de detectie onvolledig is

M046-claim blijft overeind (functioneel vangnet werkt), maar de
**waarde-reductie** (30-40% detection improvement) wordt pas gerealiseerd
wanneer dit access-blocker is opgelost.

## Status

- S05 T01-T05 commits zijn correct en blijven in branch
  `m046/s05-bug3-rce-monumenten`
- 5 iron-rule tests dekken zowel RCE-success-path als fallback-path
- Scan pipeline schrijft `rijksmonument=None` voor alle nieuwe scans
  tot blocker opgelost is — graceful degradation ✓
- Geen Alembic head wijziging

## Owner

info@klarifai.nl (contact RCE + evalueer PoolParty-account optie).
