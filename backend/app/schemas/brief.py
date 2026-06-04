"""M052/S04 — Contact brief-teaser request/response schemas."""
from pydantic import BaseModel


class Addressee(BaseModel):
    eigenaar_aanhef: str | None = None
    eigenaar_adres: str | None = None


class GenerateBriefRequest(BaseModel):
    addressee: Addressee | None = None  # handmatige NAW (particulier-modus)


class SendBriefRequest(BaseModel):
    markdown: str


class GenerateBriefResponse(BaseModel):
    markdown: str  # volledige brief (letterhead + NAW + datum + body) — legacy
    body: str  # body-only (betreft + alinea's + groet) — frontend rendert chrome zelf
    mode: str  # 'auto' (rechtspersoon/overheid) | 'manual' (geen record)


class SendBriefResponse(BaseModel):
    status: str  # 'verzonden'
    sent_at: str
