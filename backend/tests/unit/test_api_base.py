"""Tests for government API base module: exception hierarchy and handle_api_response."""

import pytest

from app.government_apis.base import (
    APINotFoundError,
    APIRateLimitError,
    APITimeoutError,
    GovernmentAPIError,
    handle_api_response,
)
from tests.api_mocks import make_mock_response


class TestHandleAPIResponse:
    def test_200_returns_json(self):
        response = make_mock_response(200, {"key": "value"})
        result = handle_api_response(response, source="test")
        assert result == {"key": "value"}

    def test_404_raises_not_found(self):
        response = make_mock_response(404, url="https://api.example.com/missing")
        with pytest.raises(APINotFoundError) as exc_info:
            handle_api_response(response, source="test")
        assert exc_info.value.status_code == 404
        assert exc_info.value.source == "test"

    def test_429_raises_rate_limit(self):
        response = make_mock_response(429, url="https://api.example.com/limited")
        with pytest.raises(APIRateLimitError) as exc_info:
            handle_api_response(response, source="test")
        assert exc_info.value.status_code == 429
        assert exc_info.value.source == "test"

    def test_500_raises_government_error(self):
        response = make_mock_response(500, url="https://api.example.com/error")
        with pytest.raises(GovernmentAPIError) as exc_info:
            handle_api_response(response, source="test")
        assert exc_info.value.status_code == 500


class TestExceptionHierarchy:
    def test_all_subclass_government_api_error(self):
        assert issubclass(APINotFoundError, GovernmentAPIError)
        assert issubclass(APIRateLimitError, GovernmentAPIError)
        assert issubclass(APITimeoutError, GovernmentAPIError)

    def test_all_subclass_exception(self):
        assert issubclass(GovernmentAPIError, Exception)
