"""Unit tests for category_classifier.classify_bekendmaking()."""

import pytest

from app.services.category_classifier import classify_bekendmaking


# ---------------------------------------------------------------------------
# Permit categories
# ---------------------------------------------------------------------------


def test_permit_aangevraagd_via_aanvraag():
    title = "Aanvraag omgevingsvergunning - Hoofdstraat 10, Amsterdam"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning aangevraagd"


def test_permit_aangevraagd_via_aangevraagde():
    title = "Aangevraagde omgevingsvergunning reguliere procedure"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning aangevraagd"


def test_permit_verleend_via_verleende():
    title = "Verleende omgevingsvergunning - reguliere procedure - Kerkstraat 5"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning verleend"


def test_permit_verleend_via_verleend():
    title = "Omgevingsvergunning verleend voor verbouw woning"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning verleend"


def test_permit_geweigerd_via_geweigerde():
    title = "Geweigerde omgevingsvergunning - Nieuwstraat 3"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning geweigerd"


def test_permit_geweigerd_via_geweigerd():
    title = "Omgevingsvergunning geweigerd - uitgebreide procedure"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning geweigerd"


def test_permit_ingetrokken():
    title = "Omgevingsvergunning ingetrokken - Dorpsstraat 8"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning ingetrokken"


def test_permit_buiten_behandeling():
    title = "Aanvraag buiten behandeling gesteld - Laan der Vrijheid 20"
    assert classify_bekendmaking(title, "permit") == "Buiten behandeling gesteld"


def test_permit_bezwaar_via_bezwaar():
    title = "Bezwaar omgevingsvergunning sloop garage"
    assert classify_bekendmaking(title, "permit") == "Bezwaar ingediend"


def test_permit_bezwaar_via_bezwaarschrift():
    title = "Bezwaarschrift ingediend tegen verleende vergunning"
    assert classify_bekendmaking(title, "permit") == "Bezwaar ingediend"


def test_permit_ontwerpbesluit():
    title = "Ontwerpbesluit omgevingsvergunning ter visie gelegd"
    assert classify_bekendmaking(title, "permit") == "Ontwerpbesluit ter inzage"


def test_permit_ter_inzage():
    title = "Omgevingsvergunning ter inzage - uitgebreide procedure"
    assert classify_bekendmaking(title, "permit") == "Ontwerpbesluit ter inzage"


def test_permit_reguliere():
    title = "Reguliere omgevingsvergunning - uitbouw woning"
    assert classify_bekendmaking(title, "permit") == "Reguliere omgevingsvergunning"


def test_permit_sloop_melding():
    title = "Melding sloop asbesthoudende dakbedekking"
    assert classify_bekendmaking(title, "permit") == "Sloop-/brandveiligheidmelding"


def test_permit_brandveilig_melding():
    title = "Melding brandveilig gebruik bedrijfspand"
    assert classify_bekendmaking(title, "permit") == "Sloop-/brandveiligheidmelding"


def test_permit_kapvergunning():
    title = "Kapvergunning aangevraagd voor 3 bomen"
    assert classify_bekendmaking(title, "permit") == "Kapvergunning"


def test_permit_kappen():
    title = "Vergunning kappen monumentale linde"
    assert classify_bekendmaking(title, "permit") == "Kapvergunning"


def test_permit_fallback():
    title = "Vergunning voor het plaatsen van een schutting"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning"


# ---------------------------------------------------------------------------
# Zoning categories
# ---------------------------------------------------------------------------


def test_zoning_nieuw_plan():
    title = "Nieuw plan bestemmingsplan Centrum 2024"
    assert classify_bekendmaking(title, "zoning") == "Nieuw bestemmingsplan"


def test_zoning_gewijzigd():
    title = "Bestemmingsplan Binnenstad gewijzigd vastgesteld"
    # "vastgesteld" wins because it is checked first
    assert classify_bekendmaking(title, "zoning") == "Bestemmingsplan vastgesteld"


def test_zoning_gewijzigd_only():
    title = "Plan gewijzigd - Industrieterrein Noord"
    assert classify_bekendmaking(title, "zoning") == "Bestemmingsplan gewijzigd"


def test_zoning_vastgesteld():
    title = "Bestemmingsplan Havenkwartier vastgesteld"
    assert classify_bekendmaking(title, "zoning") == "Bestemmingsplan vastgesteld"


def test_zoning_ontwerp():
    title = "Ontwerp bestemmingsplan Woonwijk Oost ter inzage"
    assert classify_bekendmaking(title, "zoning") == "Ontwerpbestemmingsplan"


def test_zoning_fallback():
    title = "Ruimtelijk plan gepubliceerd"
    assert classify_bekendmaking(title, "zoning") == "Bestemmingsplanwijziging"


# ---------------------------------------------------------------------------
# Case-insensitive matching
# ---------------------------------------------------------------------------


def test_case_insensitive_permit_upper():
    title = "VERLEENDE OMGEVINGSVERGUNNING - KERKPLEIN 1"
    assert classify_bekendmaking(title, "permit") == "Omgevingsvergunning verleend"


def test_case_insensitive_zoning_mixed():
    title = "Bestemmingsplan VASTGESTELD door gemeenteraad"
    assert classify_bekendmaking(title, "zoning") == "Bestemmingsplan vastgesteld"


# ---------------------------------------------------------------------------
# Unknown change_type fallback
# ---------------------------------------------------------------------------


def test_unknown_change_type_fallback():
    title = "Some random publication"
    assert classify_bekendmaking(title, "unknown") == "Wijziging"
