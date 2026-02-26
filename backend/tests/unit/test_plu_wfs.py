"""Unit tests for PLU WMS maatvoering parsing."""

from app.government_apis.plu_wfs import PLUWMSClient


def test_extract_metrics_from_features_parses_bebouwingspercentage():
    client = PLUWMSClient()
    features = [
        {
            "properties": {
                "maatvoering": '"maximum bebouwingspercentage terrein (%)"="75"',
                "naam": "maximum bebouwingspercentage (%)",
            }
        }
    ]

    metrics = client._extract_metrics_from_features(features)

    assert metrics["max_bebouwingspercentage"] == 75.0
    assert metrics["max_floor_area_ratio"] is None


def test_extract_metrics_from_features_parses_far():
    client = PLUWMSClient()
    features = [
        {
            "properties": {
                "maatvoering": '"maximum FSI"="2,5"',
                "naam": "maximale floor area ratio",
            }
        }
    ]

    metrics = client._extract_metrics_from_features(features)

    assert metrics["max_bebouwingspercentage"] is None
    assert metrics["max_floor_area_ratio"] == 2.5
