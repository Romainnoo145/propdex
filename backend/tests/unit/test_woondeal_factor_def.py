from app.ai.factors.woondeal import (
    GemeenteOpgave,
    WoondealPayload,
    WOONDEAL_FACTOR_DEF,
)


def test_factor_def_identity():
    assert WOONDEAL_FACTOR_DEF.factor_id == "woondeal"
    assert WOONDEAL_FACTOR_DEF.tool_name == "extract_woondeal"
    assert WOONDEAL_FACTOR_DEF.payload_model is WoondealPayload


def test_payload_validates_real_venlo_row():
    payload = WoondealPayload.model_validate(
        {
            "regio_naam": "Noord-Limburg",
            "provincie": "Limburg",
            "periode": "2022-2030",
            "gemeenten": [
                {
                    "gemeente_naam": "Venlo",
                    "toevoegingen": 1745,
                    "plancapaciteit": 1594,
                    "sleutelprojecten_aantal": 2,
                    "sleutelprojecten_woningen": 706,
                }
            ],
            "aandeel_betaalbaar": 0.667,
            "betaalbaar_definitie": "sociale huur + huur tot EUR1.000 + koop < EUR355.000",
            "regelingen": ["KLC", "BIRK", "Woningbouwimpuls"],
            "doelgroepen": ["aandachtsgroepen"],
            "randvoorwaarden": [],
            "algemeen_citaat": "",
            "confidence": 0.9,
        }
    )
    assert payload.gemeenten[0].gemeente_naam == "Venlo"
    assert payload.gemeenten[0].toevoegingen == 1745


def test_input_schema_is_anthropic_shaped():
    schema = WOONDEAL_FACTOR_DEF.input_schema
    assert schema["type"] == "object"
    assert "gemeenten" in schema["properties"]
    assert schema["required"] == ["confidence"]
