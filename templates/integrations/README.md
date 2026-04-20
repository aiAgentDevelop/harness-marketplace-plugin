# Observability Integration Templates

Scaffold templates for third-party observability platforms. Populated into the
generated harness when the user selects the matching platform in Wizard
Phase 4 Step D (Observability Stack Selection).

## Directory layout

```
templates/integrations/
├── sentry/
│   ├── nextjs-init.ts.template          → instrumentation.ts
│   ├── node-backend-init.ts.template    → src/instrument.ts (or similar)
│   ├── error-boundary.tsx.template      → app/error-boundary.tsx
│   └── health-check.ts.template         → app/api/health/route.ts
├── posthog/
│   ├── nextjs-init.ts.template          → app/providers/posthog-provider.tsx
│   └── events-catalog.md.template       → docs/events-catalog.md
└── README.md                            (this file)
```

## Wizard → template mapping

The Wizard's Phase 5 Generation step consults the user's observability answers
from Phase 4 Step D and emits integration files by following this mapping:

| Wizard answer | Emitted files |
|---|---|
| `observability.error_tracking.platform_id == "sentry"` AND `frontend.framework == "nextjs"` | `sentry/nextjs-init.ts.template`, `sentry/error-boundary.tsx.template`, `sentry/health-check.ts.template` |
| `observability.error_tracking.platform_id == "sentry"` AND `backend.framework IN ["express", "nestjs", "fastify"]` | `sentry/node-backend-init.ts.template`, `sentry/health-check.ts.template` |
| `observability.product_analytics` includes `"posthog"` AND `frontend.framework == "nextjs"` | `posthog/nextjs-init.ts.template`, `posthog/events-catalog.md.template` |
| other platforms (Datadog, New Relic, etc.) | no template yet — Wizard emits a `TODO.md` stub with a link to the official docs |

## Template conventions

1. **File header**: Every template starts with a banner comment identifying
   the plugin version, usage instructions, and required env vars.
2. **Tokens**: `{{PROJECT_NAME}}`, `{{VERSION}}`, `{{TRACES_SAMPLE_RATE}}`,
   `{{PROFILES_SAMPLE_RATE}}` are resolved at generation time.
3. **Conditional blocks**: `{{CONDITION:flag}} ... {{/CONDITION:flag}}` blocks
   are emitted only when the referenced classification flag is true.
4. **Custom rules marker**: Every generated file ends with
   `// ═══ CUSTOM RULES BELOW (preserved on upgrade) ═══` so user edits
   survive `/harness-marketplace:upgrade`.

## Adding a new platform

1. Add an entry to `data/observability-platforms.yaml` with
   `integration_template_path: integrations/<platform>/`.
2. Create templates under `templates/integrations/<platform>/`, following the
   three conventions above.
3. Extend the Wizard → template mapping table above.
4. Extend `scripts/validate-harness.js` if the platform requires schema-level
   validation (e.g., required env vars in `.env.example`).
5. Add a test case to `tests/observability-smoke.sh` that compiles the new
   templates with a representative token set.
