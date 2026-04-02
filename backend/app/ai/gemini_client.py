"""Thin factory for Google Gemini (google-genai) client.

Used exclusively by the Verkenner agent — all other AI call sites
continue to use Anthropic via claude_client.py.
"""

from google import genai

from app.core.config import settings


def create_gemini_client() -> genai.Client:
    """Return a google-genai Client configured with the project API key."""
    return genai.Client(api_key=settings.GOOGLE_AI_API_KEY)


def get_gemini_model() -> str:
    """Return the configured Gemini model ID."""
    return settings.GEMINI_MODEL
