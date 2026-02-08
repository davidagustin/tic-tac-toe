---
description: Project rules – TDD, task completion, monorepo conventions, push when done, no extra MD, multi-agent
alwaysApply: true
---

# Project Rules

## TDD for New Features

When adding **new features**:

1. **Write tests first** – Before implementation, add or update tests that define the expected behavior (unit via Vitest, or e2e as appropriate).
2. **Implement to pass** – Write the minimal code needed to make those tests pass.
3. **Run the tests** – Execute `npm run test` from root (Turbo runs all workspace tests) and confirm all new and existing tests pass before considering the feature done.
4. **Fix failures** – If any test fails, fix the code or the test until the suite is green; do not leave failing tests.

For small fixes or refactors, add or update tests when behavior changes, and always run the relevant tests before finishing.

---

## Task Completion – Loop Until Done

When working on a task:

1. **Loop until done** – Keep iterating on the task until it is fully complete. Do not stop with partial implementations or "good enough" states.
2. **Verify before claiming completion** – Before saying the task is done:
   - Run the relevant verification (`npm run lint`, `npm run test`, `npm run build`).
   - Read the output and confirm it actually passed.
   - Only then treat the task as complete.
3. **No partial completion** – Deliver the full scope. If verification fails or something is missing, fix it and re-verify; do not leave failing tests or broken builds.
4. **Use a todo list** – For multi-step work, track items and ensure every item is completed before finishing.

Do not claim completion without fresh verification evidence (e.g. test/build output showing success).

---

## Monorepo Conventions

This is a **Turborepo monorepo** with npm workspaces:

- **`packages/shared`** (`@ttt/shared`) – Game logic, types, constants. Shared by all apps.
- **`apps/server`** (`@ttt/server`) – Fastify 5 API with Prisma + JWT auth.
- **`apps/mobile`** (`@ttt/mobile`) – Expo Router app with NativeWind.

Rules:
1. **Shared logic goes in `packages/shared`** – Game types, validation, constants belong here, not duplicated in apps.
2. **Import from `@ttt/shared`** – Never copy shared code into app directories.
3. **Type-check all workspaces** – Run `tsc --noEmit` in each workspace. The `lint` script in each workspace does this.
4. **Respect workspace boundaries** – Server code should never import mobile code and vice versa. Both import from shared.

---

## Linting & Formatting

- **Biome** is the project linter and formatter. Run `npm run lint:biome` to check, `npm run format` to auto-fix.
- **TypeScript strict mode** is enabled in all workspaces. Do not add `@ts-ignore` or weaken strict settings.
- **Pre-commit hooks** (Husy + lint-staged) run automatically. If a hook fails, fix the issue — do not bypass with `--no-verify`.

---

## Commit When Done

When you finish a task that changes files:

1. **Stage** the relevant files (`git add`).
2. **Commit** with a clear message describing the work.

Do **not** push to the remote automatically. Only push if the user explicitly asks.

---

## No Extra Markdown Files

- **Do not** create additional `.md` files (e.g. CONTRIBUTING.md, CHANGELOG.md, docs/*.md, task plans) unless they have **functional value** for the app.
- **Consolidate** all informational documentation into **README.md**.
- **Delete stale planning files** – Task breakdowns and one-time planning documents must be deleted once completed.
- **Exception:** `.claude/rules/*.md` files are allowed.

---

## Multi-Agent Unique Tasks

When spawning or orchestrating multiple agents:

1. **Assign distinct work** – Each agent must have a clearly different responsibility. No two agents should be given the same task.
2. **Partition by scope** – Split work by file, feature, layer, or step so there is no overlap.
3. **Avoid duplicate effort** – Before spawning, confirm the task list has no duplicate entries.
4. **Name or tag tasks** – Label them so it's obvious which agent does what.

---

## Security

- **Never commit secrets** – `.env` files, API keys, and credentials must stay in `.gitignore`.
- **Use `.env.example`** – Placeholder values only, never real secrets.
- **SSM Parameter Store** for production secrets (not hardcoded).
- **Validate all user input** with Zod schemas on the server.
