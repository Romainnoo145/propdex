"""Anthropic Claude API client for PDF bestemmingsplan parsing and jurisprudence analysis."""

import base64
import json
import logging
from datetime import datetime

import anthropic

from app.ai.prompts import BESTEMMINGSPLAN_PARSING_PROMPT, JURIDISCH_ANALYSE_PROMPT_V2
from app.ai.schemas import BestemmingsplanParsed, JuridischAnalysisResult
from app.services.doorlooptijd import extract_relevant_sections

logger = logging.getLogger(__name__)


class AIParsingError(Exception):
    """Raised when Claude AI parsing fails."""

    def __init__(self, message: str, retriable: bool = False):
        self.message = message
        self.retriable = retriable
        super().__init__(message)


class ClaudeClient:
    """
    Async wrapper around Anthropic SDK for PDF bestemmingsplan parsing.

    Supports direct Anthropic API or OpenRouter as proxy.
    Uses Claude Sonnet 4.5 with structured outputs to extract zoning rules
    from Dutch bestemmingsplan PDFs with confidence scoring.
    """

    DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
    MAX_TOKENS = 16000  # PDF parsing needs large output
    MAX_TOKENS_JURISPRUDENCE = 4000  # JSON analysis of 5 rulings fits easily
    OPENROUTER_BASE_URL = "https://openrouter.ai/api"

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str | None = None,
        model: str | None = None,
    ):
        """
        Initialize Claude client.

        Args:
            api_key: API key (Anthropic or OpenRouter)
            base_url: Override base URL (e.g. OpenRouter)
            model: Override model ID
        """
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = anthropic.AsyncAnthropic(**kwargs)
        self.model = model or self.DEFAULT_MODEL

    async def parse_bestemmingsplan(
        self, pdf_data: bytes, plan_idn: str
    ) -> BestemmingsplanParsed:
        """
        Parse bestemmingsplan PDF with Claude and return structured output.

        Uses prompt caching for cost optimization - the PDF is cached with ephemeral
        cache control, reducing costs for repeated parsing attempts.

        Args:
            pdf_data: PDF file bytes
            plan_idn: IMRO plan identifier (for context/validation)

        Returns:
            BestemmingsplanParsed: Structured output with all extracted rules

        Raises:
            AIParsingError: If API call fails or response cannot be parsed
        """
        try:
            # Encode PDF as base64 for API
            pdf_base64 = base64.standard_b64encode(pdf_data).decode("utf-8")

            logger.info(
                f"Parsing bestemmingsplan {plan_idn} with Claude ({len(pdf_data)} bytes)"
            )

            # Call Claude API with PDF document
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.MAX_TOKENS,
                system=[
                    {
                        "type": "text",
                        "text": BESTEMMINGSPLAN_PARSING_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf_base64,
                                },
                                "cache_control": {"type": "ephemeral"},
                            },
                            {
                                "type": "text",
                                "text": f"Analyseer dit bestemmingsplan (plan_idn: {plan_idn}) en extraheer alle relevante regels volgens de instructies. Retourneer het resultaat als JSON volgens het BestemmingsplanParsed schema.",
                            },
                        ],
                    }
                ],
            )

            # Extract text from response
            if not response.content:
                raise AIParsingError("Claude returned empty response", retriable=True)

            # Get the text content block
            text_content = None
            for block in response.content:
                if block.type == "text":
                    text_content = block.text
                    break

            if not text_content:
                raise AIParsingError(
                    "No text content in Claude response", retriable=True
                )

            # Parse JSON from text (Claude may wrap in markdown code blocks)
            json_text = text_content.strip()
            if json_text.startswith("```json"):
                json_text = json_text[7:]
            if json_text.startswith("```"):
                json_text = json_text[3:]
            if json_text.endswith("```"):
                json_text = json_text[:-3]
            json_text = json_text.strip()

            # Validate with Pydantic schema
            try:
                parsed = BestemmingsplanParsed.model_validate_json(json_text)
                logger.info(
                    f"Successfully parsed {plan_idn}: {len(parsed.regels)} rules, "
                    f"confidence={parsed.overall_confidence}"
                )
                return parsed
            except Exception as e:
                logger.error(f"Failed to validate Claude response JSON: {e}")
                logger.debug(f"Response text: {json_text[:500]}...")
                raise AIParsingError(
                    f"Invalid JSON structure from Claude: {e}", retriable=False
                ) from e

        except anthropic.RateLimitError as e:
            logger.warning(f"Claude rate limit hit: {e}")
            raise AIParsingError(
                "AI service rate limit exceeded - try again later", retriable=True
            ) from e

        except anthropic.APIConnectionError as e:
            logger.error(f"Claude connection error: {e}")
            raise AIParsingError(
                "Could not connect to AI service", retriable=True
            ) from e

        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            raise AIParsingError(
                f"AI service error: {e}", retriable=False
            ) from e

        except AIParsingError:
            # Re-raise our custom errors
            raise

        except Exception as e:
            logger.exception(f"Unexpected error parsing PDF with Claude: {e}")
            raise AIParsingError(
                f"Unexpected parsing error: {e}", retriable=False
            ) from e

    async def analyze_jurisprudence(
        self,
        rulings: list[dict],
        gemeente_naam: str,
        max_chars_per_ruling: int = 15000,
    ) -> JuridischAnalysisResult:
        """
        Analyze Dutch court rulings for property development risk assessment.

        Uses section extraction for intelligent text truncation, sends to Claude
        for analysis with vergunningstype classification, computes
        vergunnings_succeskans and juridisch_klimaat_score in Python.

        Args:
            rulings: List of dicts with keys: ecli, text, instantie, datum_uitspraak
            gemeente_naam: Municipality name for context
            max_chars_per_ruling: Max characters per ruling text (default 15000)

        Returns:
            JuridischAnalysisResult with per-ruling analysis and aggregated scores

        Raises:
            AIParsingError: If API call fails or response cannot be parsed
        """
        try:
            # Extract relevant sections instead of naive truncation
            truncated_rulings = []
            for r in rulings:
                text = r.get("text", "")
                section_text = extract_relevant_sections(text, max_chars_per_ruling)
                truncated_rulings.append({
                    "ecli": r["ecli"],
                    "instantie": r.get("instantie", ""),
                    "datum_uitspraak": r.get("datum_uitspraak", ""),
                    "text": section_text,
                })

            # Build user message
            user_message = (
                f"Gemeente: {gemeente_naam}\n\n"
                f"Uitspraken:\n{json.dumps(truncated_rulings, ensure_ascii=False, indent=2)}"
            )

            logger.info(
                "Analyzing %d rulings for %s with Claude",
                len(rulings),
                gemeente_naam,
            )

            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.MAX_TOKENS_JURISPRUDENCE,
                system=JURIDISCH_ANALYSE_PROMPT_V2,
                messages=[
                    {"role": "user", "content": user_message},
                ],
            )

            # Extract text from response
            if not response.content:
                raise AIParsingError("Claude returned empty response", retriable=True)

            text_content = None
            for block in response.content:
                if block.type == "text":
                    text_content = block.text
                    break

            if not text_content:
                raise AIParsingError(
                    "No text content in Claude response", retriable=True
                )

            # Strip markdown code fences
            json_text = text_content.strip()
            if json_text.startswith("```json"):
                json_text = json_text[7:]
            if json_text.startswith("```"):
                json_text = json_text[3:]
            if json_text.endswith("```"):
                json_text = json_text[:-3]
            json_text = json_text.strip()

            # Parse partial response (Claude returns without computed fields)
            try:
                # Parse with placeholder scores — we compute them below
                partial = json.loads(json_text)

                # Compute vergunnings_succeskans in Python
                ruling_analyses = partial.get("ruling_analyses", [])
                total = max(len(ruling_analyses), 1)
                toegewezen = sum(
                    1 for r in ruling_analyses if r.get("uitkomst") == "toegewezen"
                )
                afgewezen = sum(
                    1 for r in ruling_analyses if r.get("uitkomst") == "afgewezen"
                )

                partial["vergunnings_succeskans"] = round(100 * toegewezen / total)
                partial["juridisch_klimaat_score"] = round(100 - (100 * afgewezen / total))
                partial["analyzed_at"] = datetime.utcnow().isoformat()

                result = JuridischAnalysisResult.model_validate(partial)
                logger.info(
                    "Successfully analyzed %d rulings for %s: klimaat=%d, succeskans=%d",
                    len(result.ruling_analyses),
                    gemeente_naam,
                    result.juridisch_klimaat_score,
                    result.vergunnings_succeskans,
                )
                return result

            except Exception as e:
                logger.error(f"Failed to validate Claude response JSON: {e}")
                logger.debug(f"Response text: {json_text[:500]}...")
                raise AIParsingError(
                    f"Invalid JSON structure from Claude: {e}", retriable=False
                ) from e

        except anthropic.RateLimitError as e:
            logger.warning(f"Claude rate limit hit: {e}")
            raise AIParsingError(
                "AI service rate limit exceeded - try again later", retriable=True
            ) from e

        except anthropic.APIConnectionError as e:
            logger.error(f"Claude connection error: {e}")
            raise AIParsingError(
                "Could not connect to AI service", retriable=True
            ) from e

        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            raise AIParsingError(
                f"AI service error: {e}", retriable=False
            ) from e

        except AIParsingError:
            raise

        except Exception as e:
            logger.exception(f"Unexpected error in jurisprudence analysis: {e}")
            raise AIParsingError(
                f"Unexpected analysis error: {e}", retriable=False
            ) from e


def create_claude_client() -> ClaudeClient:
    """Create ClaudeClient from application settings.

    Uses OpenRouter when OPENROUTER_API_KEY is set, otherwise direct Anthropic.
    """
    from app.core.config import settings

    if settings.OPENROUTER_API_KEY:
        return ClaudeClient(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=ClaudeClient.OPENROUTER_BASE_URL,
            model=settings.AI_MODEL,
        )
    return ClaudeClient(api_key=settings.ANTHROPIC_API_KEY, model=settings.AI_MODEL)


def create_chat_claude_client() -> ClaudeClient:
    """Create ClaudeClient for chat classification.

    Uses AI_MODEL_CHAT if set, otherwise falls back to AI_MODEL.
    Uses OpenRouter when OPENROUTER_API_KEY is set, otherwise direct Anthropic.
    """
    from app.core.config import settings

    model = settings.AI_MODEL_CHAT or settings.AI_MODEL
    if settings.OPENROUTER_API_KEY:
        return ClaudeClient(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=ClaudeClient.OPENROUTER_BASE_URL,
            model=model,
        )
    return ClaudeClient(api_key=settings.ANTHROPIC_API_KEY, model=model)
