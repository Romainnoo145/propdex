from app.jurisprudentie.dakkapel_cases import DAKKAPEL_CASES
from app.jurisprudentie.models import JurisprudentieCase
from app.jurisprudentie.splitsing_cases import SPLITSING_CASES

_REGISTRY: dict[str, list[JurisprudentieCase]] = {
    "splitsing": SPLITSING_CASES,
    "dakkapel": DAKKAPEL_CASES,
}


def select_cases(
    verbouwingstype: str,
    themas: list[str],
    gemeente_code: str | None,
    *,
    limit: int = 4,
    cases: list[JurisprudentieCase] | None = None,
) -> list[JurisprudentieCase]:
    pool = cases if cases is not None else _REGISTRY.get(verbouwingstype, [])
    wanted = set(themas)

    def score(c: JurisprudentieCase) -> tuple[int, int]:
        if c.verbouwingstype != verbouwingstype:
            return (-1, 0)
        overlap = len(wanted.intersection(c.themas))
        same_gem = 1 if (gemeente_code and c.gemeente_code == gemeente_code) else 0
        return (overlap, same_gem)

    scored = [(score(c), c) for c in pool if c.verbouwingstype == verbouwingstype]
    # keep only cases with at least 1 thema-overlap when themas were given
    if wanted:
        scored = [s for s in scored if s[0][0] > 0]
    scored.sort(key=lambda s: (s[0][1], s[0][0]), reverse=True)
    return [c for _, c in scored[:limit]]
