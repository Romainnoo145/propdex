"""Assemble PropertyReportResponse enrichment fields from scan_results.flags."""

from dataclasses import asdict
from datetime import datetime

from app.schemas.property import DataSourceInfo, SectionSourceInfo
from app.services.use_case_scoring import compute_use_case_scores


def assemble_enrichment_from_flags(flags: dict) -> dict:
    """Extract pre-cached enrichment from scan_results.flags into PropertyReportResponse field dict."""
    # Compute use-case scores on-the-fly from stored breakdown
    breakdown = flags.get("score_breakdown")
    uc_scores = None
    if breakdown:
        uc_results = compute_use_case_scores(breakdown)
        if uc_results:
            uc_scores = {
                uc_id: asdict(uc_score)
                for uc_id, uc_score in uc_results.items()
            }

    return {
        "vergunningen_data": flags.get("vergunningen"),
        "energielabel_flags": flags.get("energielabel"),
        "woz_flags": flags.get("woz"),
        "bodem_flags": flags.get("bodem"),
        "bodemtype_flags": flags.get("bodemtype"),
        "funderingsrisico_flags": flags.get("funderingsrisico"),
        "natura2000_flags": flags.get("natura2000"),
        "overstromingsrisico_flags": flags.get("overstromingsrisico"),
        "geluid_flags": flags.get("geluid"),
        "luchtkwaliteit_flags": flags.get("luchtkwaliteit"),
        "scores_v3": flags.get("scores"),
        "score_breakdown_v3": flags.get("score_breakdown"),
        "use_case_scores": uc_scores,
        "score_model_version": flags.get("score_model_version"),
    }


# Source mapping: flags key -> (section display name, data source name, confidence)
FLAGS_SOURCE_MAP: dict[str, tuple[str, str, str]] = {
    "vergunningen": ("Vergunningen", "SRU Bekendmakingen API", "HIGH"),
    "energielabel": ("Energielabel", "EP-Online V5", "HIGH"),
    "woz": ("WOZ Waarde", "Waardeloket", "HIGH"),
    "bodem": ("Bodemkwaliteit", "Bodemloket", "MEDIUM"),
    "bodemtype": ("Bodemtype", "BRO Bodemkaart WMS", "MEDIUM"),
    "funderingsrisico": ("Funderingsrisico", "PDOK Funderingsrisicogebieden WFS", "MEDIUM"),
    "natura2000": ("Natura 2000", "PDOK Natura2000 WFS", "HIGH"),
    "overstromingsrisico": ("Overstromingsrisico", "Risicokaart WMS", "MEDIUM"),
    "geluid": ("Geluidbelasting", "RIVM Geluidregister WMS", "MEDIUM"),
    "luchtkwaliteit": ("Luchtkwaliteit", "RIVM NSL Monitoring WMS", "MEDIUM"),
    "scores": ("Score Analyse", "Propdex Score v3.0 Engine", "HIGH"),
}


def build_flags_section_sources(
    flags: dict,
    scan_created_at: datetime,
) -> list[SectionSourceInfo]:
    """Build SectionSourceInfo list for all flags-sourced enrichment sections."""
    age_seconds = int((datetime.utcnow() - scan_created_at).total_seconds())
    cached_at_iso = scan_created_at.isoformat()
    sources: list[SectionSourceInfo] = []
    for flag_key, (section_name, source_name, confidence) in FLAGS_SOURCE_MAP.items():
        if flags.get(flag_key) is not None:
            sources.append(
                SectionSourceInfo(
                    section=section_name,
                    sources=[
                        DataSourceInfo(
                            source=source_name,
                            cached_at=cached_at_iso,
                            age_seconds=age_seconds,
                            is_cached=True,
                            confidence=confidence,  # type: ignore[arg-type]
                        )
                    ],
                    cached_at=cached_at_iso,
                    age_seconds=age_seconds,
                )
            )
    return sources
