# AGENTS.md

Generally speaking, you should browse the codebase to figure out what is going on.

## Task Completion Requirements

- All of `vp fmt`, `vp lint`, and `vp check` must pass before considering tasks completed.

## Project Snapshot

This project is a browser extension and companion web app that helps autofill/speed up the process of submitting purchase requests on Engage for University of Oregon students.

This repository is WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

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

- `apps/web`: TanStack Start + React Web App
- `apps/extension`: Manifest V3 Chrome extension
- `convex/`: Convex backend

## Expectations

- Use shadcn for base components `vpx shadcn@latest add {component}`
- Keep designs simple, no over explaining, plain colors, no gradients, no decorative elements.
- Assume dev servers for both Convex and `bun dev` are already running.

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

## References

- Open Source TanStack Start + Convex + Clerk: ~/Code/oss/lawn
- Convex code demos: ~/Code/oss/convex-demos
- Clerk + Convex: https://clerk.com/docs/guides/development/integrations/databases/convex
- Skills: use ~/.agents/skills/find-skills to locate relevant skills wherever possible
- TanStack Start: https://tanstack.com/start/latest
