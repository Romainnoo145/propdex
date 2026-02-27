"""Unit tests for Funda listing ingestion helpers."""

from app.services.funda_listing_ingestion import (
    build_funda_search_url,
    extract_funda_detail_links,
    parse_funda_detail_page,
)


def test_build_funda_search_url_encodes_area():
    url = build_funda_search_url("Arcen")
    assert "selected_area=" in url
    assert "arcen" in url.lower()


def test_extract_funda_detail_links_from_html():
    html = """
    <html><body>
      <a href="/detail/koop/arcen/huis-maasstraat-1/12345678/">x</a>
      <a href="https://www.funda.nl/detail/koop/arcen/huis-maasstraat-2/87654321/">y</a>
    </body></html>
    """
    links = extract_funda_detail_links(html)
    assert len(links) == 2
    assert links[0].startswith("https://www.funda.nl/detail/koop/")


def test_parse_funda_detail_page_extracts_core_fields():
    html = """
    <html>
      <head>
        <title>Huis te koop: Maasstraat 117 5944 CC Arcen | Funda</title>
      </head>
      <body>
        <dl>
          <dt>Vraagprijs</dt><dd><span>€ 299.000 kosten koper</span></dd>
          <dt>Status</dt><dd><span>Beschikbaar</span></dd>
          <dt>Aangeboden sinds</dt><dd><span>24 februari 2026</span></dd>
        </dl>
      </body>
    </html>
    """
    listing = parse_funda_detail_page(
        "https://www.funda.nl/detail/koop/arcen/huis-maasstraat-117/89623341/",
        html,
    )

    assert listing is not None
    assert listing.listing_external_id == "89623341"
    assert listing.street == "Maasstraat"
    assert listing.house_number == "117"
    assert listing.postcode == "5944CC"
    assert listing.city == "Arcen"
    assert listing.price_eur == 299000
    assert listing.listing_status == "Beschikbaar"
