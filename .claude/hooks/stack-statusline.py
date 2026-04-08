#!/usr/bin/env python3
"""Statusline — toont GSD milestone/slice/phase + skills-in-slice + context%.

Wraps Claude Code's stdin JSON contract. Designed to REPLACE the user-global
gsd-statusline.js for this project only. Outputs a single line to stdout.
"""

import json
import os
import re
import sys
from pathlib import Path

GSD_STATE = Path("/home/klarifai/.gsd/projects/0fbd70b53f1b/STATE.md")
SLICE_STATE_DIR = Path(__file__).parent.parent / "state" / "slices"

# ANSI helpers
DIM = "\x1b[2m"
BOLD = "\x1b[1m"
RESET = "\x1b[0m"
GREEN = "\x1b[32m"
YELLOW = "\x1b[33m"
ORANGE = "\x1b[38;5;208m"
RED = "\x1b[31m"
CYAN = "\x1b[36m"
MAGENTA = "\x1b[35m"


def parse_gsd_state():
    if not GSD_STATE.exists():
        return None, None, None
    text = GSD_STATE.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"^\*\*Active Milestone:\*\*\s*(.+)$", text, re.M)
    s = re.search(r"^\*\*Active Slice:\*\*\s*(.+)$", text, re.M)
    p = re.search(r"^\*\*Phase:\*\*\s*(.+)$", text, re.M)
    milestone = m.group(1).split(":")[0].strip() if m else None
    slice_id = s.group(1).split(":")[0].strip() if s else None
    phase = p.group(1).strip() if p else None
    return milestone, slice_id, phase


def slice_key(milestone, slice_id):
    if not milestone or not slice_id:
        return None
    return re.sub(r"[^a-zA-Z0-9]", "_", f"{milestone}_{slice_id}")[:60]


def used_skills_for_slice(milestone, slice_id):
    key = slice_key(milestone, slice_id)
    if not key:
        return []
    marker = SLICE_STATE_DIR / f"{key}.skills"
    if not marker.exists():
        return []
    return [line.strip() for line in marker.read_text().splitlines() if line.strip()]


def context_bar(remaining_pct):
    """Mirror gsd-statusline.js logic."""
    if remaining_pct is None:
        return ""
    AUTO_COMPACT_BUFFER_PCT = 16.5
    usable_remaining = max(
        0,
        ((remaining_pct - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100,
    )
    used = max(0, min(100, round(100 - usable_remaining)))
    filled = used // 10
    bar = "█" * filled + "░" * (10 - filled)
    if used < 50:
        color = GREEN
    elif used < 65:
        color = YELLOW
    elif used < 80:
        color = ORANGE
    else:
        color = RED
    return f" {color}{bar} {used}%{RESET}"


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    model = (data.get("model") or {}).get("display_name", "Claude")
    workspace = data.get("workspace") or {}
    cwd = workspace.get("current_dir") or os.getcwd()
    dirname = os.path.basename(cwd)
    remaining = (data.get("context_window") or {}).get("remaining_percentage")

    milestone, slice_id, phase = parse_gsd_state()
    skills = used_skills_for_slice(milestone, slice_id)

    # Brainstorm marker — show if missing for visual nudge
    has_brainstorm = any("brainstorm" in s.lower() for s in skills)
    brainstorm_flag = ""
    if milestone and slice_id:
        brainstorm_flag = (
            f" {GREEN}✓bs{RESET}" if has_brainstorm else f" {YELLOW}!bs{RESET}"
        )

    # Stack segment — show slice only if actually active (not "-" placeholder)
    if milestone:
        if slice_id and slice_id != "-":
            stack = f"{CYAN}{milestone}/{slice_id}{RESET} {DIM}·{RESET} {MAGENTA}{phase or '?'}{RESET}{brainstorm_flag}"
        else:
            stack = f"{CYAN}{milestone}{RESET} {DIM}·{RESET} {MAGENTA}{phase or '?'}{RESET}"
    else:
        stack = f"{DIM}(no GSD state){RESET}"

    ctx = context_bar(remaining)

    sys.stdout.write(
        f"{stack} {DIM}│{RESET} {DIM}{model}{RESET} {DIM}│{RESET} {DIM}{dirname}{RESET}{ctx}"
    )


if __name__ == "__main__":
    main()
