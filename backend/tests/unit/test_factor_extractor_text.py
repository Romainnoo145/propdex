import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.ai.factor_extractor import extract_factor_live
from app.ai.factors.beleidsalignement import OMGEVINGSVISIE_FACTOR_DEF


def _mock_client(captured: dict):
    client = MagicMock()
    async def _create(**kwargs):
        captured.update(kwargs)
        tool_use = SimpleNamespace(type="tool_use", name=OMGEVINGSVISIE_FACTOR_DEF.tool_name,
                                   input={"tijdshorizon": 2040, "confidence": 0.9, "gebied_policies": [], "algemeen_citaat": ""})
        return SimpleNamespace(content=[tool_use], usage=SimpleNamespace(input_tokens=1, output_tokens=1))
    client.messages = SimpleNamespace(create=AsyncMock(side_effect=_create))
    return client


@pytest.mark.asyncio
async def test_text_document_sent_as_text_block():
    captured: dict = {}
    doc = SimpleNamespace(id=uuid.uuid4(), filename="ov.txt",
                          file_data=b"Omgevingsvisie 2040 tekst")
    await extract_factor_live(factor_def=OMGEVINGSVISIE_FACTOR_DEF, parcel_id="p",
                              policy_document=doc, claude_client=_mock_client(captured))
    blocks = captured["messages"][0]["content"]
    assert blocks[0]["type"] == "text"
    assert "Omgevingsvisie 2040 tekst" in blocks[0]["text"]
    assert all(b["type"] != "document" for b in blocks)


@pytest.mark.asyncio
async def test_pdf_still_sent_as_document_block():
    captured: dict = {}
    doc = SimpleNamespace(id=uuid.uuid4(), filename="wv.pdf", file_data=b"%PDF-1.7\n...")
    await extract_factor_live(factor_def=OMGEVINGSVISIE_FACTOR_DEF, parcel_id="p",
                              policy_document=doc, claude_client=_mock_client(captured))
    blocks = captured["messages"][0]["content"]
    assert blocks[0]["type"] == "document"
    assert blocks[0]["source"]["media_type"] == "application/pdf"
