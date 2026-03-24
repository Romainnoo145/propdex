"""Pydantic schemas for per-organization score weight customization."""

from pydantic import BaseModel, field_validator


class ScoreWeightsConfig(BaseModel):
    """Current score weights configuration for an organization."""

    preset: str = "standaard"
    potentie_risico_balance: float = 0.7  # 0.0 = full risico, 1.0 = full potentie
    potentie_weights: dict[str, int] = {}  # factor_name -> weight 1-10 (0 = disabled)
    risico_weights: dict[str, int] = {}
    score_threshold: int = 50  # Minimum score to show on map (0-100)


class SaveScoreWeightsRequest(BaseModel):
    """Request body for PUT /org/score-weights."""

    preset: str
    potentie_risico_balance: float
    potentie_weights: dict[str, int]
    risico_weights: dict[str, int]
    score_threshold: int = 50

    @field_validator("potentie_risico_balance")
    @classmethod
    def validate_balance(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("Balance must be between 0.0 and 1.0")
        return round(v, 2)

    @field_validator("score_threshold")
    @classmethod
    def validate_threshold(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("Threshold must be between 0 and 100")
        return v

    @field_validator("potentie_weights", "risico_weights")
    @classmethod
    def validate_weights(cls, v: dict[str, int]) -> dict[str, int]:
        for name, w in v.items():
            if not 0 <= w <= 10:
                raise ValueError(f"Weight for {name} must be 0-10")
        # At least 3 active (non-zero) — validated at endpoint level for cross-field check
        return v


class ScoreWeightsResponse(BaseModel):
    """Response for GET /org/score-weights and after PUT save."""

    weights: ScoreWeightsConfig
    is_custom: bool  # True if org has non-default weights
    job_id: str | None = None  # Set after save triggers re-score


class RescoreJobStatus(BaseModel):
    """Response for GET /org/score-weights/job/{job_id} status polling."""

    status: str  # queued, in_progress, complete, failed
    processed: int = 0
    up_count: int = 0
    down_count: int = 0
    unchanged_count: int = 0
    avg_delta: float = 0.0
