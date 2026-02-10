"""Tests for BRK Bevragen client: disabled mode, mTLS config, never-store policy."""

import inspect
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.government_apis.base import GovernmentAPIError
from app.government_apis.brk_bevragen import BRKBevragenClient, brk_limiter
from tests.api_mocks import make_mock_client, make_mock_response


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable rate limiter for all tests in this module."""
    original_enabled = brk_limiter.enabled
    brk_limiter.enabled = False
    yield
    brk_limiter.enabled = original_enabled


class TestBRKBevragenClient:
    def test_disabled_when_not_configured(self):
        """Verify client is disabled when BRK settings are not configured."""
        # Create client with default settings (empty BRK config)
        with patch("app.government_apis.brk_bevragen.settings") as mock_settings:
            mock_settings.BRK_API_KEY = ""
            mock_settings.BRK_CLIENT_CERT_PATH = ""
            mock_settings.BRK_CLIENT_KEY_PATH = ""
            mock_settings.BRK_CA_BUNDLE_PATH = ""

            client = BRKBevragenClient()

            # Verify: client is not configured
            assert client._configured is False
            assert client._ssl_context is None

    @pytest.mark.asyncio
    async def test_disabled_mode_raises_on_query(self):
        """Verify disabled client raises GovernmentAPIError on query attempts."""
        # Create unconfigured client
        with patch("app.government_apis.brk_bevragen.settings") as mock_settings:
            mock_settings.BRK_API_KEY = ""
            mock_settings.BRK_CLIENT_CERT_PATH = ""
            mock_settings.BRK_CLIENT_KEY_PATH = ""
            mock_settings.BRK_CA_BUNDLE_PATH = ""

            client = BRKBevragenClient()

            # Mock client (won't be used since client is disabled)
            mock_http_client = AsyncMock()

            # Verify: raises GovernmentAPIError with descriptive message
            with pytest.raises(GovernmentAPIError) as exc_info:
                await client.get_kadastraal_object(
                    "NL.IMKAD.KadastraalObject.12345", mock_http_client
                )

            assert exc_info.value.source == "brk-bevragen"
            assert "not configured" in str(exc_info.value)

    def test_configured_validates_cert_paths(self):
        """Verify constructor raises RuntimeError when cert files are missing."""
        # Point to nonexistent certificate files
        with patch("app.government_apis.brk_bevragen.settings") as mock_settings:
            mock_settings.BRK_API_KEY = "test-key"
            mock_settings.BRK_CLIENT_CERT_PATH = "/nonexistent/client.crt"
            mock_settings.BRK_CLIENT_KEY_PATH = "/nonexistent/client.key"
            mock_settings.BRK_CA_BUNDLE_PATH = "/nonexistent/ca-bundle.crt"

            # Verify: raises RuntimeError with descriptive message
            with pytest.raises(RuntimeError) as exc_info:
                BRKBevragenClient()

            error_message = str(exc_info.value)
            assert "missing certificate files" in error_message
            assert "client.crt" in error_message
            assert "client.key" in error_message
            assert "ca-bundle.crt" in error_message

    @pytest.mark.asyncio
    async def test_get_kadastraal_object_sends_correct_headers(self):
        """Verify get_kadastraal_object sends correct headers and CRS."""
        # Mock configured client
        with patch("app.government_apis.brk_bevragen.settings") as mock_settings:
            with patch(
                "app.government_apis.brk_bevragen._create_brk_ssl_context"
            ) as mock_ssl:
                # Configure settings
                mock_settings.BRK_API_KEY = "test-api-key"
                mock_settings.BRK_CLIENT_CERT_PATH = "/fake/client.crt"
                mock_settings.BRK_CLIENT_KEY_PATH = "/fake/client.key"
                mock_settings.BRK_CA_BUNDLE_PATH = "/fake/ca-bundle.crt"

                # Mock Path.exists() to return True
                with patch("pathlib.Path.exists", return_value=True):
                    # Mock SSL context creation
                    mock_ssl.return_value = MagicMock()

                    client = BRKBevragenClient()

                    # Mock HTTP response
                    response = make_mock_response(
                        200, json_data={"identificatie": "NL.IMKAD.KadastraalObject.12345"}
                    )
                    mock_http_client = make_mock_client(get=response)

                    # Call get_kadastraal_object
                    result = await client.get_kadastraal_object(
                        "NL.IMKAD.KadastraalObject.12345", mock_http_client
                    )

                    # Verify: request includes correct headers
                    call_kwargs = mock_http_client.get.call_args.kwargs
                    assert call_kwargs["headers"]["X-Api-Key"] == "test-api-key"
                    assert call_kwargs["headers"]["Accept-Crs"] == "epsg:28992"

                    # Verify: returns JSON data
                    assert result["identificatie"] == "NL.IMKAD.KadastraalObject.12345"

    def test_eigendom_never_store_contract(self):
        """Verify BRK module does NOT import database or cache modules."""
        # Import the module
        import app.government_apis.brk_bevragen as brk_module

        # Get all imported names in the module
        module_members = dir(brk_module)

        # Verify: NO database model imports
        assert "ParcelCache" not in module_members
        assert "BuildingCache" not in module_members
        assert "AsyncSession" not in module_members

        # Verify: NO cache manager imports
        assert "CacheManager" not in module_members
        assert "cache_manager" not in module_members

        # Verify using inspect: check actual source code
        source_lines = inspect.getsource(brk_module)

        # Verify: NO imports of database/cache modules
        assert "from app.models" not in source_lines
        assert "from app.cache" not in source_lines
        assert "import app.models" not in source_lines
        assert "import app.cache" not in source_lines

    @pytest.mark.asyncio
    async def test_api_error_propagates(self):
        """Verify HTTP 403 error raises GovernmentAPIError."""
        # Mock configured client
        with patch("app.government_apis.brk_bevragen.settings") as mock_settings:
            with patch(
                "app.government_apis.brk_bevragen._create_brk_ssl_context"
            ) as mock_ssl:
                # Configure settings
                mock_settings.BRK_API_KEY = "test-api-key"
                mock_settings.BRK_CLIENT_CERT_PATH = "/fake/client.crt"
                mock_settings.BRK_CLIENT_KEY_PATH = "/fake/client.key"
                mock_settings.BRK_CA_BUNDLE_PATH = "/fake/ca-bundle.crt"

                # Mock Path.exists() to return True
                with patch("pathlib.Path.exists", return_value=True):
                    # Mock SSL context creation
                    mock_ssl.return_value = MagicMock()

                    client = BRKBevragenClient()

                    # Mock error response (403 Forbidden - typical for cert issues)
                    response = make_mock_response(403)
                    mock_http_client = make_mock_client(get=response)

                    # Verify: raises GovernmentAPIError with source="brk-bevragen"
                    with pytest.raises(GovernmentAPIError) as exc_info:
                        await client.get_kadastraal_object(
                            "NL.IMKAD.KadastraalObject.12345", mock_http_client
                        )

                    assert exc_info.value.source == "brk-bevragen"
                    assert exc_info.value.status_code == 403
