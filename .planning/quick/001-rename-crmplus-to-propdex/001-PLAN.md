---
phase: quick
plan: 001-rename-crmplus-to-propdex
type: execute
wave: 1
depends_on: []
files_modified:
  - all modified files (52 files, already changed)
  - all untracked test/planning files
  - ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md
autonomous: false

must_haves:
  truths:
    - "All crmplus references in code and docs are replaced with propdex"
    - "Project directory is named propdex, not crmplus"
    - "Git history is intact after rename"
    - "Claude project memory works from new directory path"
  artifacts:
    - path: "/home/klarifai/Documents/klarifai/clientprojects/propdex"
      provides: "Renamed project directory"
    - path: "~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md"
      provides: "Claude project memory at new path"
  key_links:
    - from: "project directory"
      to: "git repo"
      via: "mv preserves .git"
      pattern: "git log works from new path"
---

<objective>
Commit all the crmplus-to-propdex rename changes that were already made to code and docs, then rename the project directory itself, and set up Claude project memory at the new path.

Purpose: Complete the project rename from crmplus to propdex so the codebase, directory, and tooling all reflect the new name.
Output: Clean git commit, renamed directory, Claude memory at new path.
</objective>

<execution_context>
@/home/klarifai/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
Working directory: /home/klarifai/Documents/klarifai/clientprojects/crmplus
All 52 files already modified with crmplus->propdex replacements.
11 untracked files (test files, summaries, research) also need to be committed.
Database already renamed: crmplus -> propdex, crmplus_test dropped.
All 233 tests passing.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit all rename changes</name>
  <files>52 modified files + 11 untracked files (see git status)</files>
  <action>
    Stage and commit ALL changes — both modified and untracked files — in a single commit.

    1. Stage all modified files (the 52 files with crmplus->propdex replacements):
       ```
       git add -A
       ```
       NOTE: Exclude `backend/.coverage` from the commit (add to .gitignore or git reset it after staging).

    2. Check that `backend/.coverage` is not staged. If it is, unstage it:
       ```
       git reset HEAD backend/.coverage
       ```

    3. Commit with message:
       ```
       rename: crmplus -> propdex across codebase

       Rename project from CRM Plus to Propdex in all code, config,
       planning docs, and test files. Database already renamed.

       - 52 files: replace crmplus/CRM Plus with propdex/Propdex
       - pyproject.toml, config.py, main.py, .env.example
       - All planning docs and research files
       - Test infrastructure (conftest, test files)
       - SQL setup scripts and email templates
       ```

    4. Verify commit succeeded with `git log --oneline -1`.
  </action>
  <verify>
    `git status` shows clean working tree (only untracked .coverage).
    `git log --oneline -1` shows the rename commit.
  </verify>
  <done>All rename changes committed in a single clean commit. Working tree is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Rename project directory and set up Claude memory</name>
  <files>
    /home/klarifai/Documents/klarifai/clientprojects/crmplus -> propdex
    ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md
  </files>
  <action>
    1. Rename the project directory:
       ```
       mv /home/klarifai/Documents/klarifai/clientprojects/crmplus \
          /home/klarifai/Documents/klarifai/clientprojects/propdex
       ```

    2. Verify the rename worked:
       ```
       ls /home/klarifai/Documents/klarifai/clientprojects/propdex/backend/pyproject.toml
       cd /home/klarifai/Documents/klarifai/clientprojects/propdex && git log --oneline -1
       ```

    3. Create Claude project memory directory for the new path:
       ```
       mkdir -p ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory
       ```

    4. Copy the existing MEMORY.md to the new path:
       ```
       cp ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-crmplus/memory/MEMORY.md \
          ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md
       ```

    5. Verify the new memory file exists and has content:
       ```
       head -5 ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md
       ```

    6. Do NOT delete the old Claude memory directory yet — the user may want to verify the new one works first.
  </action>
  <verify>
    `ls /home/klarifai/Documents/klarifai/clientprojects/propdex/backend/` shows project files.
    `cd /home/klarifai/Documents/klarifai/clientprojects/propdex && git status` works.
    `cat ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-propdex/memory/MEMORY.md` shows project memory.
  </verify>
  <done>
    Project directory is /home/klarifai/Documents/klarifai/clientprojects/propdex.
    Git repo works from new location. Claude memory exists at new path.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Committed all crmplus->propdex rename changes and moved the project directory.
    Set up Claude project memory at the new path.
  </what-built>
  <how-to-verify>
    1. Open a NEW terminal and cd to `/home/klarifai/Documents/klarifai/clientprojects/propdex`
    2. Run `git log --oneline -3` to confirm rename commit is there
    3. Run `cd backend && python -m pytest tests/ -x -q` to confirm 233 tests still pass
    4. Start a new Claude Code session from the propdex directory to confirm project memory loads
    5. Once confirmed working, optionally delete old memory:
       `rm -rf ~/.claude/projects/-home-klarifai-Documents-klarifai-clientprojects-crmplus`
  </how-to-verify>
  <resume-signal>Type "approved" if everything works, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
- `git log --oneline -1` from propdex directory shows rename commit
- `ls /home/klarifai/Documents/klarifai/clientprojects/propdex/` shows full project
- `/home/klarifai/Documents/klarifai/clientprojects/crmplus` does NOT exist
- Claude project memory exists at new path-based directory
- 233 tests still pass from new location
</verification>

<success_criteria>
1. All rename changes committed in a clean git commit
2. Project directory renamed from crmplus to propdex
3. Claude project memory copied to new path-based directory
4. Git repo and tests functional from new location
</success_criteria>

<output>
No summary file needed for quick plans.
</output>
