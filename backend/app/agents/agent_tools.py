"""Tool definitions and executors for the Propdex Verkenner agent.

Tools are defined as Gemini FunctionDeclarations (google-genai SDK).
Google Search grounding is added as a separate Tool entry.
All executor functions are read-only — only SELECT queries, never
INSERT/UPDATE/DELETE.
"""

import json
import uuid as _uuid

from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.bulk_query_service import resolve_gemeente_code
from app.models.checklist_progress import ChecklistProgress
from app.models.parcel_favorite import ParcelFavorite
from app.models.policy_document import PolicyDocument
from app.models.report import SavedReport
from app.policy_documents.service import get_summaries
from app.policy_documents.source_keys import get_source_key_label
from app.services.checklists import CHECKLISTS
from app.services.gemeente_name_lookup import get_gemeente_name_map
from app.services.juridisch_klimaat_builder import build_juridisch_klimaat_payload

# ── Gemini FunctionDeclaration definitions ───────────────────────────────

_LIST_FAVORITES = types.FunctionDeclaration(
    name="list_favorites",
    description=(
        "Haal de opgeslagen favoriete percelen (pipeline) op van de gebruiker. "
        "Optioneel te filteren op gemeente of pipeline-status."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "gemeente": types.Schema(
                type="STRING",
                description="Filter op gemeentenaam (case-insensitive substring match).",
            ),
            "stage": types.Schema(
                type="STRING",
                description=(
                    "Filter op pipeline-status: Gesignaleerd, Onderzoek, "
                    "Contact, Besluit, of Afgerond."
                ),
            ),
        },
        required=[],
    ),
)

_LIST_REPORTS = types.FunctionDeclaration(
    name="list_reports",
    description=(
        "Haal de opgeslagen vastgoedrapporten op van de gebruiker. "
        "Bevat al de belangrijkste scores en kenmerken per rapport: "
        "potentie, risico, bouwjaar, oppervlakte, gebruiksdoel, bestemming, "
        "energielabel, asbestrisico, fysiek risico en monumentstatus. "
        "Gebruik dit voor vergelijkingen en overzichten — get_report is "
        "alleen nodig voor diepere details van één specifiek perceel."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "city": types.Schema(
                type="STRING",
                description="Filter op stad/gemeente (case-insensitive substring match).",
            ),
        },
        required=[],
    ),
)

_GET_REPORT = types.FunctionDeclaration(
    name="get_report",
    description=(
        "Haal het volledige vastgoedrapport op voor één specifiek perceel. "
        "Bevat gedetailleerde data over bestemmingsplan, energie, bodem, "
        "eigendom en risicoprofiel. Gebruik alleen wanneer de gebruiker "
        "diepere details over één perceel wil — voor vergelijkingen en "
        "overzichten is list_reports voldoende."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "report_id": types.Schema(
                type="STRING",
                description="UUID van het rapport.",
            ),
        },
        required=["report_id"],
    ),
)


_QUERY_POLICY_DOCUMENTS = types.FunctionDeclaration(
    name="query_policy_documents",
    description=(
        "Zoek beleidsdocumenten (welstandsnota, omgevingsvisie, woonvisie, etc.) "
        "die zijn geüpload in de gemeenteconfiguratie. Geeft de AI-samenvatting "
        "per document terug. Gebruik dit wanneer de gebruiker vraagt over "
        "gemeentelijk beleid, bestemmingsregels, welstandseisen, of andere "
        "beleidsdocumenten voor een specifieke gemeente."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "gemeente": types.Schema(
                type="STRING",
                description=(
                    "Gemeentenaam om te zoeken (bijv. 'Amsterdam', 'Venlo'). "
                    "Zoekt op alle gemeentecodes die voor deze organisatie zijn geconfigureerd."
                ),
            ),
            "source_key": types.Schema(
                type="STRING",
                description=(
                    "Filter op specifiek documenttype: welstandsnota, omgevingsvisie, "
                    "woonvisie, parkeerbeleid, leegstandsverordening, duurzaamheidsbeleid, "
                    "erfgoedverordening, gemeentelijke-subsidies, nieuws-monitoring."
                ),
            ),
        },
        required=[],
    ),
)

_GET_CHECKLIST_STATUS = types.FunctionDeclaration(
    name="get_checklist_status",
    description=(
        "Haal de checkliststatus op voor een specifiek perceel. Toont welke "
        "checklist-items zijn afgevinkt per use case (optoppen, splitsen, "
        "transformatie, nieuwbouw). Gebruik dit wanneer de gebruiker vraagt "
        "over de voortgang van een vergunningchecklist."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "parcel_id": types.Schema(
                type="STRING",
                description="Kadaster perceel-ID (bijv. 'HTT02-A-1234').",
            ),
            "use_case": types.Schema(
                type="STRING",
                description=(
                    "Filter op use case: optoppen, splitsen, transformatie, "
                    "of nieuwbouw. Laat leeg voor alle use cases."
                ),
            ),
        },
        required=["parcel_id"],
    ),
)


_GET_BELEIDSCONTEXT = types.FunctionDeclaration(
    name="get_beleidscontext",
    description=(
        "Haal de concrete gemeentelijke beleidsrandvoorwaarden (uit omgevingsvisie, "
        "woonvisie, parkeerbeleid, huisvestingsverordening, etc.) EN het juridisch "
        "klimaat (goedkeuringspercentage uit jurisprudentie) op voor een gemeente. "
        "Gebruik dit ALTIJD bij ontwikkel- of beleidsvragen over een perceel — "
        "bijvoorbeeld 'mag ik hier optoppen / splitsen / een woning toevoegen / "
        "transformeren?'. Geeft geëxtraheerde, letterlijke randvoorwaarden terug die "
        "je moet citeren met bronvermelding. Verzin nooit zelf randvoorwaarden."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "gemeente": types.Schema(
                type="STRING",
                description=(
                    "Gemeentenaam (bijv. 'Venlo'). Gebruik de gemeente van het perceel "
                    "waarover de vraag gaat."
                ),
            ),
            "gemeente_code": types.Schema(
                type="STRING",
                description=(
                    "CBS gemeentecode (bijv. 'GM0983'). Geef deze mee wanneer bekend — "
                    "dan is de resolutie exact. Wordt geprefereerd boven de naam."
                ),
            ),
            "source_key": types.Schema(
                type="STRING",
                description=(
                    "Optioneel filter op één documenttype: omgevingsvisie, woonvisie, "
                    "parkeerbeleid, huisvestingsverordening, welstandsnota. Laat leeg "
                    "voor alle beschikbare beleidsdocumenten."
                ),
            ),
        },
        required=[],
    ),
)


def get_agent_tools() -> list[types.Tool]:
    """Return Gemini Tool objects: user-data functions.

    Note: GoogleSearch grounding cannot be combined with FunctionDeclarations
    in the same request on Gemini 2.5 Pro (only supported on Gemini 3+).
    Google Search is omitted here; the agent relies on training data for
    external advisory questions.
    """
    return [
        types.Tool(function_declarations=[
            _LIST_FAVORITES, _LIST_REPORTS, _GET_REPORT,
            _QUERY_POLICY_DOCUMENTS, _GET_CHECKLIST_STATUS,
            _GET_BELEIDSCONTEXT,
        ]),
    ]


# Bound the tool output so a data-rich gemeente (e.g. Venlo ~48 randvoorwaarden)
# cannot blow up the agent context window.
_MAX_RANDVOORWAARDEN_TOTAL = 40
_MAX_SAMENVATTING_CHARS = 320


# ── Internal executor helpers (read-only queries) ───────────────────────


def _serialize(data: object) -> str:
    """JSON-serialize with Dutch-safe encoding and fallback for dates."""
    return json.dumps(data, ensure_ascii=False, default=str)


async def _list_favorites(
    db: AsyncSession,
    user_id: str,
    gemeente: str | None = None,
    stage: str | None = None,
) -> str:
    query = select(ParcelFavorite).where(
        ParcelFavorite.user_id == _uuid.UUID(user_id)
    )

    if stage:
        query = query.where(ParcelFavorite.pipeline_stage == stage)
    if gemeente:
        query = query.where(ParcelFavorite.gemeente_naam.ilike(f"%{gemeente}%"))

    query = query.order_by(ParcelFavorite.created_at.desc()).limit(50)

    result = await db.execute(query)
    rows = result.scalars().all()

    favorites = [
        {
            "parcel_id": f.parcel_id,
            "address": f.address,
            "gemeente_naam": f.gemeente_naam,
            "wijk_naam": f.wijk_naam,
            "pipeline_stage": f.pipeline_stage,
        }
        for f in rows
    ]
    return _serialize(favorites)


async def _list_reports(
    db: AsyncSession,
    user_id: str,
    city: str | None = None,
) -> str:
    query = select(SavedReport).where(
        SavedReport.user_id == _uuid.UUID(user_id),
        SavedReport.deleted_at.is_(None),
    )

    if city:
        query = query.where(SavedReport.city.ilike(f"%{city}%"))

    query = query.order_by(SavedReport.created_at.desc()).limit(50)

    result = await db.execute(query)
    rows = result.scalars().all()

    reports = []
    for r in rows:
        rd = r.report_data or {}
        scores = rd.get("scores_v3") or {}
        building = rd.get("building") or {}
        zoning = rd.get("zoning") or {}
        energy = rd.get("energy_label") or {}
        asbest = rd.get("asbest_indicator") or {}
        frp = rd.get("fysiek_risico_profiel") or {}
        monuments = rd.get("monuments") or {}

        gebruiksdoel_raw = building.get("gebruiksdoel")
        if isinstance(gebruiksdoel_raw, list):
            gebruiksdoel = ", ".join(gebruiksdoel_raw)
        else:
            gebruiksdoel = gebruiksdoel_raw

        reports.append(
            {
                "id": str(r.id),
                "report_name": r.report_name,
                "city": r.city,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "potentie": scores.get("potentie"),
                "risico": scores.get("risico"),
                "bouwjaar": building.get("bouwjaar"),
                "oppervlakte": building.get("oppervlakte"),
                "gebruiksdoel": gebruiksdoel,
                "bestemming": zoning.get("primary_bestemming"),
                "energielabel": energy.get("energieklasse"),
                "asbest_risk": asbest.get("risk"),
                "fysiek_risk": frp.get("overall_risk"),
                "is_monument": monuments.get("is_monument"),
            }
        )

    return _serialize(reports)


async def _get_report(
    db: AsyncSession,
    user_id: str,
    report_id: str,
) -> str:
    """Fetch the full report_data JSONB for a single report owned by the user."""
    try:
        rid = _uuid.UUID(report_id)
    except ValueError:
        return _serialize({"error": f"Ongeldig rapport-ID: {report_id}"})

    result = await db.execute(
        select(SavedReport).where(
            SavedReport.id == rid,
            SavedReport.user_id == _uuid.UUID(user_id),
            SavedReport.deleted_at.is_(None),
        )
    )
    report = result.scalar_one_or_none()

    if report is None:
        return _serialize({"error": f"Rapport niet gevonden: {report_id}"})

    # Return the full report_data JSONB — not a summary
    return _serialize(
        {
            "id": str(report.id),
            "report_name": report.report_name,
            "city": report.city,
            "postcode": report.postcode,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "report_data": report.report_data,
        }
    )


async def _query_policy_documents(
    db: AsyncSession,
    user_id: str,
    organization_id: str,
    gemeente: str | None = None,
    source_key: str | None = None,
) -> str:
    """List policy documents with AI summaries for the user's organization."""
    query = (
        select(
            PolicyDocument.entity_type,
            PolicyDocument.entity_code,
            PolicyDocument.source_key,
            PolicyDocument.filename,
            PolicyDocument.ai_summary,
            PolicyDocument.created_at,
        )
        .where(
            PolicyDocument.organization_id == _uuid.UUID(organization_id),
            PolicyDocument.ai_summary.isnot(None),
            PolicyDocument.ai_summary != "",
        )
        .order_by(PolicyDocument.created_at.desc())
        .limit(20)
    )

    if source_key:
        query = query.where(PolicyDocument.source_key == source_key)

    result = await db.execute(query)
    rows = result.all()

    docs = [
        {
            "entity_type": r.entity_type,
            "entity_code": r.entity_code,
            "source_key": r.source_key,
            "filename": r.filename,
            "ai_summary": r.ai_summary[:1500] if r.ai_summary else None,  # truncate for context
            "uploaded_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    if not docs:
        return _serialize({"message": "Geen beleidsdocumenten gevonden met AI-samenvattingen."})
    return _serialize(docs)


async def _get_checklist_status(
    db: AsyncSession,
    user_id: str,
    parcel_id: str,
    use_case: str | None = None,
) -> str:
    """Get checklist progress for a parcel across all (or one) use cases."""
    query = select(ChecklistProgress).where(
        ChecklistProgress.user_id == _uuid.UUID(user_id),
        ChecklistProgress.parcel_id == parcel_id,
    )
    if use_case:
        query = query.where(ChecklistProgress.use_case == use_case)

    result = await db.execute(query)
    rows = result.scalars().all()

    if not rows:
        return _serialize({
            "message": f"Geen checklistvoortgang gevonden voor perceel {parcel_id}.",
            "available_use_cases": list(CHECKLISTS.keys()),
        })

    statuses = []
    for row in rows:
        total_items = len(CHECKLISTS.get(row.use_case, []))
        checked_count = len(row.checked_items) if row.checked_items else 0
        statuses.append({
            "use_case": row.use_case,
            "checked_items": checked_count,
            "total_items": total_items,
            "completion_pct": round(checked_count / total_items * 100) if total_items else 0,
            "checked_item_ids": row.checked_items or [],
        })

    return _serialize(statuses)


def _compact_randvoorwaarde(rv: dict[str, object]) -> str:
    """Render one randvoorwaarde as a compact, bounded one-liner for the LLM.

    Keeps titel + samenvatting (the developer-facing bullet) and drops the long
    citaat/pagina fields to keep tool output within budget.
    """
    titel = str(rv.get("titel") or "").strip()
    samenvatting = str(rv.get("samenvatting") or "").strip()
    if len(samenvatting) > _MAX_SAMENVATTING_CHARS:
        samenvatting = samenvatting[: _MAX_SAMENVATTING_CHARS].rstrip() + "…"
    if titel and samenvatting:
        return f"{titel} — {samenvatting}"
    text_val = titel or samenvatting
    if text_val:
        return text_val
    # Fallback for unexpected shapes: truncated JSON of the raw dict.
    return _serialize(rv)[: _MAX_SAMENVATTING_CHARS]


def _build_klimaat_block(klimaat: dict[str, object] | None) -> dict[str, object]:
    """Shape build_juridisch_klimaat_payload output into a compact LLM block."""
    if not klimaat:
        return {"toelichting": "Geen jurisprudentie-data beschikbaar voor deze gemeente."}
    approval_rate = klimaat.get("approval_rate")
    block: dict[str, object] = {
        "aantal_uitspraken": klimaat.get("ruling_count"),
        "aantal_uitspraken_ontwikkeltypes": klimaat.get("ruling_count_dev_types"),
    }
    if isinstance(approval_rate, (int, float)):
        block["goedkeuringspercentage"] = round(approval_rate * 100)
    if klimaat.get("missing"):
        block["toelichting"] = (
            "Beperkte jurisprudentie-data — goedkeuringspercentage is indicatief."
        )
    return block


async def _get_beleidscontext(
    db: AsyncSession,
    organization_id: str,
    gemeente: str | None = None,
    gemeente_code: str | None = None,
    source_key: str | None = None,
) -> str:
    """Fetch cascade beleidsrandvoorwaarden + juridisch klimaat for a gemeente.

    Org-agnostic public data: get_summaries filters on is_global docs and
    build_juridisch_klimaat_payload reads the org-agnostic RulingCache. The
    organization_id is passed only to satisfy get_summaries' signature.
    """
    # 1. Resolve GM-code — supplied code is preferred over fuzzy name resolve.
    code = (gemeente_code or "").strip() or None
    if code is None and gemeente:
        code = await resolve_gemeente_code(gemeente, db)
    if not code:
        return _serialize(
            {"message": f"Gemeente niet gevonden: {gemeente or gemeente_code or '(geen)'}."}
        )

    # 2. Resolve gemeente-naam (needed for the jurisprudence lookup).
    naam = (gemeente or "").strip()
    if not naam:
        name_map = await get_gemeente_name_map(db)
        naam = name_map.get(code, code)

    # 3. Fetch cascade randvoorwaarden (org_id is ignored by get_summaries).
    try:
        org_uuid = _uuid.UUID(organization_id) if organization_id else _uuid.UUID(int=0)
    except ValueError:
        org_uuid = _uuid.UUID(int=0)
    summaries = await get_summaries("gemeente", code, org_uuid, db)

    if source_key:
        summaries = {k: v for k, v in summaries.items() if k == source_key}

    # 4. Fetch juridisch klimaat (may be None).
    klimaat = await build_juridisch_klimaat_payload(db, naam)
    klimaat_block = _build_klimaat_block(klimaat)

    # 5. Build compact, capped payload.
    beleid: dict[str, list[str]] = {}
    remaining = _MAX_RANDVOORWAARDEN_TOTAL
    for skey, randvoorwaarden in summaries.items():
        if remaining <= 0:
            break
        label = get_source_key_label("gemeente", skey) or skey
        items = [_compact_randvoorwaarde(rv) for rv in randvoorwaarden[:remaining]]
        if items:
            beleid[label] = items
            remaining -= len(items)

    if not beleid:
        return _serialize(
            {
                "message": f"Geen beleidsrandvoorwaarden gevonden voor {naam}.",
                "juridisch_klimaat": klimaat_block,
            }
        )

    return _serialize(
        {
            "gemeente": naam,
            "gemeente_code": code,
            "beleid": beleid,
            "juridisch_klimaat": klimaat_block,
        }
    )


# ── Public dispatcher ────────────────────────────────────────────────────


async def execute_tool(
    name: str,
    tool_input: dict,
    db: AsyncSession,
    user_id: str,
    organization_id: str | None = None,
) -> str:
    """Dispatch a tool call by name. Returns a JSON string."""
    if name == "list_favorites":
        return await _list_favorites(
            db, user_id,
            gemeente=tool_input.get("gemeente"),
            stage=tool_input.get("stage"),
        )
    if name == "list_reports":
        return await _list_reports(
            db, user_id,
            city=tool_input.get("city"),
        )
    if name == "get_report":
        return await _get_report(
            db, user_id,
            report_id=tool_input.get("report_id", ""),
        )
    if name == "query_policy_documents":
        return await _query_policy_documents(
            db, user_id,
            organization_id=organization_id or "",
            gemeente=tool_input.get("gemeente"),
            source_key=tool_input.get("source_key"),
        )
    if name == "get_checklist_status":
        return await _get_checklist_status(
            db, user_id,
            parcel_id=tool_input.get("parcel_id", ""),
            use_case=tool_input.get("use_case"),
        )
    if name == "get_beleidscontext":
        return await _get_beleidscontext(
            db,
            organization_id=organization_id or "",
            gemeente=tool_input.get("gemeente"),
            gemeente_code=tool_input.get("gemeente_code"),
            source_key=tool_input.get("source_key"),
        )

    return _serialize({"error": f"Onbekende tool: {name}"})
