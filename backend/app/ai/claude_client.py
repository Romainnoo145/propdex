"""Anthropic Claude API client for PDF bestemmingsplan parsing."""

import base64
import logging

import anthropic

from app.ai.prompts import BESTEMMINGSPLAN_PARSING_PROMPT
from app.ai.schemas import BestemmingsplanParsed

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

    Uses Claude Sonnet 4.5 with structured outputs to extract zoning rules
    from Dutch bestemmingsplan PDFs with confidence scoring.
    """

    MODEL = "claude-sonnet-4-5-20250929"
    MAX_TOKENS = 16000

    def __init__(self, api_key: str):
        """
        Initialize Claude client.

        Args:
            api_key: Anthropic API key
        """
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

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
                model=self.MODEL,
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
