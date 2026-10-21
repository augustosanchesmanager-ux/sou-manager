---
name: implement
description: "Implement a piece of work based on a spec or set of tickets under SMG Change Control."
disable-model-invocation: true
---

# Implementation Protocol (SMG Change Control)

> **MANDATORY INVARIANT:** All implementation work in this repository MUST comply with the **SMG Change Control Protocol**.
> Direct commits to unverified branches or working trees are strictly prohibited.
> This skill delegates directly to the canonical SMG engineering skills:
> 1. Isolate the workspace: use `smg-isolate`.
> 2. Implement the minimum scoped change: use `smg-implement`.
> 3. Validate changes locally: use `smg-validate`.
> 4. Record evidence and STOP for PO commit authorization: use `smg-stop-gate` and `smg-commit`.

## Guidelines

- Never mix unrelated fronts.
- Never modify tests merely to make them pass.
- Run typechecking (`npm run typecheck`) and unit tests (`npm test`) continuously.
- Once done, run `git diff --check`.
- **DO NOT** commit automatically. Await explicit PO authorization via the `smg-commit` gate.
