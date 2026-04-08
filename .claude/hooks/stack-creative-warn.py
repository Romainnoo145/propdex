#!/usr/bin/env python3
"""UserPromptSubmit hook — warns when user asks for creative/component work
without first invoking superpowers:brainstorming in the current slice.

Niveau 2 enforcement: NOT a block. Injects a reminder into the next agent
context so the model is nudged to invoke brainstorming before coding.

Trigger keywords (Dutch + English) tuned for component/UI work. Audit/fix
words are intentionally excluded.
"""

import json
import re
import sys
from pathlib import Path

GSD_STATE = Path("/home/klarifai/.gsd/projects/0fbd70b53f1b/STATE.md")
SLICE_STATE_DIR = Path(__file__).parent.parent / "state" / "slices"

CREATIVE_TRIGGERS = [
    r"\bbouw\s+(een\s+)?(nieuw|nieuwe)?\s*(component|ui|page|paneel|sectie|kaart)",
    r"\bmaak\s+(een\s+)?(nieuw|nieuwe)?\s*(component|ui|page|paneel|sectie|kaart)",
    r"\bcre[eë]er\s+(een\s+)?(nieuw|nieuwe)?\s*(component|ui|page)",
    r"\bnieuwe?\s+(component|ui|page|paneel|sectie|view|modal|panel)",
    r"\bdesign\s+(een|de|the)?\s*(component|ui|page|panel|modal)",
    r"\bbuild\s+(a\s+)?(new\s+)?(component|ui|page|panel|view|modal)",
    r"\bcreate\s+(a\s+)?(new\s+)?(component|ui|page|panel|view|modal)",
    r"\bnew\s+(component|ui|page|panel|view|modal)",
    r"\brebouw\s+(de|the)\s+(ui|page|component)",
    r"\bredesign\s+(de|the)?\s*(component|page|ui)",
]

# Words that explicitly mean "fix/audit existing work" — disable warning
EXEMPTION_WORDS = [
    r"\bfix\b", r"\bbug\b", r"\baudit\b", r"\brefactor\b",
    r"\bcommit\b", r"\bdoc\b", r"\bdocs\b", r"\bcheck\b",
    r"\btypo\b", r"\bbroken\b", r"\bdoesn'?t work\b",
    r"\bwerkt niet\b", r"\bstuk\b", r"\bkapot\b", r"\bherstel\b",
]


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
    return re.sub(r"[^a-zA-Z0-9]", "_", f"{milestone}_{slice_id}")[:60]


def has_brainstormed(slice_key):
    if not slice_key:
        return True  # no slice = nothing to enforce
    marker = SLICE_STATE_DIR / f"{slice_key}.skills"
    if not marker.exists():
        return False
    skills = marker.read_text().lower()
    return "brainstorm" in skills


def is_creative(prompt):
    p = prompt.lower()
    if any(re.search(rx, p) for rx in EXEMPTION_WORDS):
        return False
    return any(re.search(rx, p) for rx in CREATIVE_TRIGGERS)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    prompt = payload.get("prompt") or ""
    if not prompt or not is_creative(prompt):
        sys.exit(0)

    slice_key = parse_active_slice()
    if has_brainstormed(slice_key):
        sys.exit(0)

    # Inject warning into agent context. Per Claude Code hook docs,
    # UserPromptSubmit hooks may emit JSON to stdout that adds context.
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                "⚠️  STACK GUARD — Niveau 2 reminder\n"
                "Je vraagt om nieuw component/UI werk in de actieve slice, "
                "maar `superpowers:brainstorming` is nog niet aangeroepen voor deze slice.\n"
                "Volgens CLAUDE.md harde regel #2: brainstorm vóór nieuw component.\n"
                "Roep eerst `Skill: brainstorming` aan, of bevestig expliciet dat dit "
                "een audit/refactor is en geen nieuw werk."
            ),
        }
    }
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()
