# AGENTS.md

Generally speaking, you should browse the codebase to figure out what is going on.

## Task Completion Requirements

- All of `bun run fmt`, `bun run lint`, and `bun run check` must pass before considering tasks completed.
- Never run `bun tes`, use `bun run test` instead (runs Vitest)

## Project Snapshot

This project is a browser extension and companion web app that helps autofill/speed up the process of submitting purchase requests on Engage for University of Oregon students.

This repository is WIP and greenfield. Desctructive actions are encouraged for any sort of improvement. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Visual consistency first. Adhere to the visual style of the existing site.

If a tradeoff is required, choose correctness and robustness over short-term convenience.

Do not add excessive fallbacks. Logic should be simple, with reasonable expecations, don't `try except` everything. Use the smallest possible diff. Then think of how to make it smaller. No backwards compatability. Smallest possible set of changes to make the instructed change work and meet other priorities.

Keep files under ~400 lines. Refactor as neeeded to meet this.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there are shared logic that can be extracted to a separate module. Duplicate logic across mulitple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/web`: SvelteKit Web App
- `apps/extension`: Manifest V3 Chrome extension
- `convex/`: Convex backend

## Expectations

- Use SvelteKit/Svelte components for `apps/web`; prefer simple local components unless a shared UI primitive is clearly needed.
- Keep designs simple, no over explaining, plain colors, no gradients, no decorative elements.
- Assume dev servers for both Convex and `bun dev` are already running.
- Use EffectTS for business logic and server side code
- Use Graphite `gt --help` for PRs and stacked diffs, particularly with dependent issues.

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## References

- SvelteKit + Convex + Clerk template: ~/Code/oss/my-sveltekit-template
- Convex code demos: ~/Code/oss/convex-demos
- Clerk + Convex: https://clerk.com/docs/guides/development/integrations/databases/convex
- Skills: use ~/.agents/skills/find-skills to locate relevant skills wherever possible
