"""Intent classifier evaluation suite.

Runs real messages through classify_intent() (calls Claude API)
and checks the returned intent + key params match expectations.

Usage:
    cd backend && python -m pytest tests/eval/test_intent_eval.py -v
    cd backend && python -m pytest tests/eval/test_intent_eval.py -v --tb=short -x  # stop on first failure

Add new cases to tests/eval/intent_cases.yaml when users report misclassifications.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
import yaml

from app.agents.chat_service import classify_intent

# Load test cases from YAML
_CASES_PATH = Path(__file__).parent / "intent_cases.yaml"
_CASES = yaml.safe_load(_CASES_PATH.read_text())


def _case_id(case: dict) -> str:
    """Generate a readable test ID from the message."""
    msg = case["message"][:50].replace(" ", "_")
    return f"{case['expected_intent']}_{msg}"


@pytest.mark.parametrize("case", _CASES, ids=[_case_id(c) for c in _CASES])
@pytest.mark.asyncio
async def test_intent_classification(case: dict):
    """Classify a message and check intent + key params."""
    intent, params = await classify_intent(
        case["message"],
        previous_intent=case.get("previous_intent"),
        previous_params=case.get("previous_params"),
    )

    # Check intent
    assert intent == case["expected_intent"], (
        f"Message: {case['message']!r}\n"
        f"Expected intent: {case['expected_intent']}, got: {intent}\n"
        f"Params returned: {params}"
    )

    # Check key params (only the ones specified in expected_params)
    expected_params = case.get("expected_params", {})
    for key, expected_value in expected_params.items():
        actual_value = params.get(key)
        # Flexible matching: string contains for address, exact for others
        if key == "address" and isinstance(expected_value, str):
            assert actual_value is not None and expected_value.lower() in actual_value.lower(), (
                f"Message: {case['message']!r}\n"
                f"Expected param {key} to contain {expected_value!r}, got: {actual_value!r}"
            )
        elif isinstance(expected_value, (int, float)):
            # Allow some flexibility for numeric thresholds (classifier might pick slightly different numbers)
            if actual_value is not None:
                assert abs(actual_value - expected_value) <= expected_value * 0.3, (
                    f"Message: {case['message']!r}\n"
                    f"Expected param {key}≈{expected_value}, got: {actual_value}"
                )
        else:
            assert actual_value == expected_value, (
                f"Message: {case['message']!r}\n"
                f"Expected param {key}={expected_value!r}, got: {actual_value!r}"
            )
