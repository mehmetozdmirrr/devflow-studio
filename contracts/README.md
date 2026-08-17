# DevFlow Studio V1 Contracts

These files are the implementation-neutral source of truth for the V1 domain boundaries.

## TypeScript

- `types/project.ts`: root project aggregate.
- `types/catalog.ts`: versioned discriminated catalog.
- `types/selection.ts`: traceable project decisions.
- `types/recommendation.ts`: declarative rules and scored results.
- `types/validation.ts`: normalized issues and override policy.
- `types/ai.ts`: optional AI request/result/provider boundary.
- `types/package.ts`: generated files and manifest.
- `types/storage.ts`: persistence/backup/repository ports.

## Portable JSON boundaries

- `schemas/ai-analysis-request.schema.json`
- `schemas/ai-analysis-result.schema.json`
- `schemas/catalog-import.schema.json`
- `schemas/project-backup.schema.json`
- `schemas/package-manifest.schema.json`

During implementation, define Zod schemas first and derive or cross-test TypeScript/JSON Schema where practical so runtime and compile-time contracts cannot drift silently.

