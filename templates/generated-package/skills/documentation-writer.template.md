---
name: documentation-writer
description: Drafts user-facing documentation (README, API reference) for {{PROJECT_NAME}} from existing code and contracts.
disable-model-invocation: true
argument-hint: "[area to document]"
---

# Documentation Writer

1. Read the actual code/contract for the area being documented; do not invent behavior.
2. State purpose, setup, and usage in the order a new reader needs them.
3. Document only implemented, verified behavior; mark anything planned as not yet available.
4. Never include secrets, credentials, or internal-only configuration values.
5. Keep terminology consistent with the project's existing documents.
