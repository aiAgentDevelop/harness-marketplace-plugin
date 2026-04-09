# Project Instructions

## Documentation Rule

Every code change MUST include corresponding updates to both `README.md` and `README-ko.md`.

- New features, options, or wizard steps must be documented in both files
- Changed file structures must be reflected in the Plugin Structure section
- New skills or commands must be added to the Usage section
- Comparison table must be updated if the change differentiates from revfactory/harness
- Both README files must stay in sync — never update one without the other

## Project Overview

harness-marketplace is a Claude Code plugin that generates project-specific development pipeline harness skills via an interactive wizard.

### Key Architecture

- `skills/wizard/SKILL.md` — Main wizard with 3 entry modes (Deep Interview, Manual, Auto-Detect)
- `skills/upgrade/SKILL.md` — Template upgrade preserving config + Custom Rules
- `skills/ci-cd/SKILL.md` — Standalone CI/CD configuration
- `templates/` — Harness skeleton templates (skills, hooks, CI/CD workflows, self-learning)
- `data/` — YAML option catalogs driving wizard questions
- `scripts/` — Validation and hook merge utilities

### Three Layers

1. **Hook Enforcement** — Claude Code hooks (PreToolUse/PostToolUse) for code-level guards
2. **CI/CD Generation** — GitHub Actions / GitLab CI workflow templates
3. **Self-Learning** — Harness evolves by adding hook rules from regression patterns

### State Management

All state is file-based under `state/` directory. No external dependencies (no omc).
- `state/pipeline-state.json` — Pipeline execution state
- `state/handoffs/` — Phase handoff files
- `state/results/` — Phase result files
- `state/learning-log.yaml` — Self-learning history
