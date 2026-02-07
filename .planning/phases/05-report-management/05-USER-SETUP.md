# Phase 5 — User Setup

**Services configured in this phase require manual setup.**

This file documents external dependencies, environment variables, and dashboard configuration steps needed before the implemented features work correctly.

---

## WeasyPrint System Dependencies

**Service:** WeasyPrint PDF generation library
**Why needed:** PDF export from HTML/CSS for property intelligence reports
**Used in:** `backend/app/reports/pdf_export.py`

### Installation

WeasyPrint requires system-level libraries for font rendering and text layout.

**Fedora (your current system):**
```bash
sudo dnf install pango harfbuzz
```

**Debian/Ubuntu:**
```bash
sudo apt install libpango-1.0-0 libharfbuzz0b libpangoft2-1.0-0
```

**macOS:**
```bash
brew install pango
```

### Verification

After installation, verify WeasyPrint can generate PDFs:

```bash
cd /home/klarifai/Documents/klarifai/clientprojects/crmplus/backend
python -c "from weasyprint import HTML; HTML(string='<h1>Test</h1>').write_pdf(); print('WeasyPrint OK')"
```

Expected output: `WeasyPrint OK` (no errors)

### Troubleshooting

**If you see "Error: Failed to load Pango":**
- Verify pango is installed: `pkg-config --modversion pango` (should show version number)
- On Fedora, you may need additional packages: `sudo dnf install cairo-devel pango-devel`

**If PDF generation is slow (>5 seconds):**
- This is normal for first run (font cache building)
- Subsequent runs should be <1 second per PDF

---

## Environment Variables

None required for this phase.

---

## Dashboard Configuration

None required for this phase.

---

*Generated during plan 05-03 execution*
*Last updated: 2026-02-07*
