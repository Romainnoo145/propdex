#!/usr/bin/env python3
"""PostToolUse hook — tracks which superpowers skills were invoked in the current slice.

Writes a marker file per slice: .claude/state/slices/<slice_key>.skills
One skill name per line, deduplicated.

Triggered on every PostToolUse. We filter for the Skill tool ourselves so the
hook stays cheap.
"""

import json
import re
import sys
from pathlib import Path

GSD_STATE = Path("/home/klarifai/.gsd/projects/0fbd70b53f1b/STATE.md")
SLICE_STATE_DIR = Path(__file__).parent.parent / "state" / "slices"


def parse_active_slice():
    if not GSD_STATE.exists():
        return None
    text = GSD_STATE.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"^\*\*Active Milestone:\*\*\s*(.+)$", text, re.M)
    s = re.search(r"^\*\*Active Slice:\*\*\s*(.+)$", text, re.M)
    if not m or not s:
        return None
    milestone = m.group(1).split(":")[0].strip()
    slice_id = s.group(1).split(":")[0].strip()
    key = re.sub(r"[^a-zA-Z0-9]", "_", f"{milestone}_{slice_id}")[:60]
    return key


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name") or ""
    if tool_name != "Skill":
        sys.exit(0)

    tool_input = payload.get("tool_input") or {}
    skill = tool_input.get("skill") or ""
    if not skill:
        sys.exit(0)

    slice_key = parse_active_slice()
    if not slice_key:
        sys.exit(0)

    SLICE_STATE_DIR.mkdir(parents=True, exist_ok=True)
    marker = SLICE_STATE_DIR / f"{slice_key}.skills"

    existing = set()
    if marker.exists():
        existing = {line.strip() for line in marker.read_text().splitlines() if line.strip()}
    existing.add(skill)
    marker.write_text("\n".join(sorted(existing)) + "\n")


if __name__ == "__main__":
    main()
