"""Ad-hoc probe: test woonvisie_match extraction across gemeenten without DB writes.

Goal: verify the M047/S06 + M048/Phase 6 woonvisie extraction generalizes
beyond Venlo. Downloads PDF from user-supplied URL, runs extract_factor_live
with WOONVISIE_MATCH_FACTOR_DEF, prints structured summary.

KOOP SRU only indexes regelgeving (CVDR), not strategic visiedocumenten —
woonvisies/woonagenda's live on gemeente websites as direct PDFs.

Usage:
    cd backend
    python -m app.tools.probe_woonvisie_extraction \
      "Venlo|https://www.venlo.nl/file/57522/download" \
      "Amsterdam|https://zoek.officielebekendmakingen.nl/gmb-2017-145187.pdf"
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from types import SimpleNamespace

import httpx

from app.ai.factor_extractor import extract_factor_live
from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF


async def _fetch_pdf(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "propdex-probe/1.0"})
        if resp.status_code != 200:
            print(f"  [HTTP {resp.status_code}] {url}")
            return None
        ctype = resp.headers.get("content-type", "")
        if "pdf" not in ctype.lower() and not resp.content.startswith(b"%PDF"):
            print(f"  [NOT-PDF] content-type={ctype}")
            return None
        return resp.content
    except Exception as exc:
        print(f"  [FETCH-ERR] {type(exc).__name__}: {exc}")
        return None


async def probe_gemeente(gemeente: str, url: str) -> None:
    print(f"\n{'=' * 70}")
    print(f"GEMEENTE: {gemeente}")
    print(f"URL: {url}")
    print("=" * 70)

    pdf_bytes = await _fetch_pdf(url)
    if pdf_bytes is None:
        return

    pdf_kb = len(pdf_bytes) / 1024
    print(f"  [PDF] {pdf_kb:.1f} KB gedownload")

    stub_doc = SimpleNamespace(
        id=uuid.uuid4(),
        filename=f"{gemeente}_woonvisie.pdf",
        file_data=pdf_bytes,
    )

    print("  [LLM] extracting via Claude (Haiku)...")
    try:
        extracted = await extract_factor_live(
            factor_def=WOONVISIE_MATCH_FACTOR_DEF,
            parcel_id=f"probe-{gemeente}",
            policy_document=stub_doc,  # type: ignore[arg-type]
        )
    except Exception as exc:
        print(f"  [FAIL] extract_factor_live: {type(exc).__name__}: {exc}")
        return

    payload = extracted.payload
    print()
    print(f"  periode:           {payload.periode_start}–{payload.periode_einde}")
    print(f"  document_type:     {payload.document_type}")
    print(f"  opgave_totaal:     {payload.opgave_totaal}")
    print(f"  confidence:        {payload.confidence:.2f}")
    print(f"  algemeen_citaat:   {'JA (' + str(len(payload.algemeen_citaat)) + ' chars)' if payload.algemeen_citaat else 'leeg'}")
    print(f"  wijk_policies:     {len(payload.wijk_policies)} stuks")

    if payload.wijk_policies:
        print()
        print("  ── Wijk policies ──")
        for wp in payload.wijk_policies[:8]:
            segs = ",".join(wp.gewenste_segmenten) if wp.gewenste_segmenten else "-"
            citaat = wp.citaat[:80].replace("\n", " ")
            pag = f" p.{wp.pagina}" if wp.pagina else ""
            print(f"    {wp.wijk_naam[:32]:32s} | {wp.prioriteit:18s} | {segs:25s}{pag}")
            print(f"      └─ \"{citaat}…\"" if len(wp.citaat) > 80 else f"      └─ \"{wp.citaat}\"")
        if len(payload.wijk_policies) > 8:
            print(f"    ... en {len(payload.wijk_policies) - 8} meer")

    if payload.algemeen_citaat:
        print()
        print(f"  algemeen_citaat:  \"{payload.algemeen_citaat[:200]}…\"" if len(payload.algemeen_citaat) > 200 else f"  algemeen_citaat:  \"{payload.algemeen_citaat}\"")

    segs = []
    if payload.pct_sociaal_huur is not None:
        segs.append(f"sociaal {payload.pct_sociaal_huur:.0f}%")
    if payload.pct_middenhuur is not None:
        segs.append(f"midden-huur {payload.pct_middenhuur:.0f}%")
    if payload.pct_dure_huur is not None:
        segs.append(f"duur-huur {payload.pct_dure_huur:.0f}%")
    if payload.pct_betaalbare_koop is not None:
        segs.append(f"betaalbare-koop {payload.pct_betaalbare_koop:.0f}%")
    if payload.pct_dure_koop is not None:
        segs.append(f"dure-koop {payload.pct_dure_koop:.0f}%")
    if segs:
        print(f"  segmentverdeling:  {' / '.join(segs)}")


async def main(entries: list[str]) -> None:
    for e in entries:
        if "|" not in e:
            print(f"  [SKIP] expected 'gemeente|url', got: {e}")
            continue
        gemeente, url = e.split("|", 1)
        try:
            await probe_gemeente(gemeente.strip(), url.strip())
        except Exception as exc:
            print(f"  [ERROR] {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.tools.probe_woonvisie_extraction 'gemeente|url' [...]")
        sys.exit(1)
    asyncio.run(main(sys.argv[1:]))
