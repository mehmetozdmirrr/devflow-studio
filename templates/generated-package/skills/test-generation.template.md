---
name: test-generation
description: Drafts unit/component tests for new or changed code in {{PROJECT_NAME}}, covering happy path, boundary, and error cases.
disable-model-invocation: true
argument-hint: "[file or function to cover]"
---

# Test Generation

1. Identify the unit under test and its inputs/outputs/side effects.
2. Draft happy-path cases first, then boundary values, then error/invalid-input cases.
3. For a bug fix, draft the failing-reproduction case before the fix, not after.
4. Mock only at system boundaries (network, storage, time, randomness); never mock the behavior under test.
5. Keep each test deterministic and independent of execution order.
6. Report which acceptance criteria are now covered and which remain unverified.
