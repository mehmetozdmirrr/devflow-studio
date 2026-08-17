# Required environment variables — `analyze-project`

Set these in the Netlify site's environment variable settings (Site configuration → Environment variables). Never commit a real value; there is no local `.env` file for this package, and none should be created.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Server-only Anthropic API key. Never exposed to the client. |
| `ANTHROPIC_MODEL` | Yes | Model identifier read at request time. No default is hardcoded (no version-verified default is available this session). |
| `ALLOWED_ORIGIN` | Yes | Exact origin allowed to call this endpoint (e.g. the deployed site's own origin). |

If `ANTHROPIC_API_KEY` or `ANTHROPIC_MODEL` is unset, the function returns `AI_DISABLED` without attempting a provider call.
