from typing import Literal

from pydantic import BaseModel


class JurisprudentieCase(BaseModel):
    ecli: str
    verbouwingstype: str
    gemeente_code: str | None = None
    instantie: str
    datum: str  # ISO yyyy-mm-dd
    themas: list[str]
    uitkomst: Literal["toegekend", "geweigerd", "vernietigd", "gemengd"]
    duiding: str  # mensentaal, geverifieerd tegen bron_url
    bron_url: str
