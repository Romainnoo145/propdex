#!/usr/bin/env python3
"""PostToolUse hook — tracks which superpowers skills were invoked in the current slice.

Writes a marker file per slice: .claude/state/slices/<slice_key>.skills
One skill name per line, deduplicated.

Triggered on every PostToolUse. We filter for the Skill tool ourselves so the
hook stays cheap.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

# Source of truth = git Mxxx/Sxx commit prefixes, matching stack-context-inject.sh.
# (GSD STATE.md is no longer read — it only updates via /gsd:* commands and drifts.)
PROJ = Path("/home/klarifai/Documents/klarifai/clientprojects/propdex")
SLICE_STATE_DIR = Path(__file__).parent.parent / "state" / "slices"


def parse_active_slice():
    """Return slice key (e.g. 'M052_S01') from the latest Mxxx/Sxx git commit."""
    try:
        out = subprocess.run(
            ["git", "-C", str(PROJ), "log", "--oneline", "-80"],
            capture_output=True, text=True, timeout=5,
        ).stdout
    except Exception:
        return None
    m = re.search(r"(M0[0-9]+(?:\.[0-9]+)?)/(S[0-9]+)", out)
    if not m:
        return None
    milestone, slice_id = m.group(1), m.group(2)
    key = re.sub(r"[^a-zA-Z0-9]", "_", f"{milestone} {slice_id}")[:60]
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
