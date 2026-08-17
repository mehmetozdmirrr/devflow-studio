---
name: code-review
description: Runs a structured code review pass over a diff or file set for {{PROJECT_NAME}} and reports findings in a consistent format.
disable-model-invocation: true
argument-hint: "[diff or file set to review]"
---

# Code Review

1. Identify the scope: changed files, the requirement/acceptance IDs they claim to satisfy.
2. Check correctness against the stated requirement, not just style.
3. Check error handling, boundary conditions, and security-sensitive input/output.
4. Check test coverage actually exercises the change, not just that tests exist.
5. Flag any removed/weakened assertion, disabled check, or swallowed error.
6. Report findings ranked most-severe first: file, line, defect, concrete failing scenario.

Do not fix findings yourself unless explicitly asked; report them for the implementer to address.
