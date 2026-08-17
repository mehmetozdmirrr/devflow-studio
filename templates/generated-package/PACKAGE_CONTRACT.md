# Generated Claude Code Package Contract — V1

## Minimal tree

```text
project-kit/
├── CLAUDE.md
├── project.config.json
├── README.md
├── devflow-manifest.json
├── .claude/
│   ├── settings.json
│   ├── agents/                 # selected agents only
│   └── skills/                 # selected skills only
├── docs/
│   ├── PROJECT_BRIEF.md
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY_PLAN.md
│   ├── TEST_PLAN.md
│   └── ROADMAP.md
├── tasks/
│   ├── todo.md
│   └── lessons.md
└── mcp/
    └── recommendations.md      # recommendation only; never contains secrets
```

## Inclusion policy

- Core files are always included.
- Agents, skills, documents, and integration recommendations are included only when required, selected, or explicitly approved.
- Hooks are omitted by default. A reviewed opt-in hook must pass package/security validation.
- MCP output is recommendation/documentation only in V1; DevFlow does not install or authenticate MCP servers.
- User overrides are explicit, previewed, and recorded in the manifest.

## Safe generation policy

- UTF-8 text formats only: Markdown, JSON, and plain text.
- Relative POSIX paths only; no empty, absolute, traversal, control-character, duplicate normalized, or reserved paths.
- Stable lexical path order and stable JSON key serialization.
- No API keys, tokens, credentials, `.env` bodies, private keys, or hidden provider configuration.
- Every file has a source, inclusion reason, content hash, and edit/exclude policy.
- Error/blocker validation prevents export.

## Claude Code behavior policy

- `CLAUDE.md` contains short always-on facts and gates; procedures live in skills/documents.
- Main session orchestrates. Subagents are bounded and selected only when useful.
- Experimental Agent Teams are never a required V1 output.
- Permissions default to Plan/Ask/Deny. Generated content never recommends bypassing permissions.
- External writes, paid APIs, deployments, commits/pushes, data deletion, migrations, MCP, and hooks require explicit human approval.

