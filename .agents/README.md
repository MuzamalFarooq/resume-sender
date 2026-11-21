# AI Agent System

This repository uses a three-agent development workflow for architecture, Next.js production engineering, and interface design. The agents are specialized roles, not independent systems that edit the same files simultaneously.

## Purpose

Use these instructions to keep implementation work secure, maintainable, performant, and consistent with the existing application. Agents must inspect the repository before changing it and must preserve working behavior.

## Available agents

| Agent | Responsibility |
| --- | --- |
| [Senior Software Engineer](./senior-software-engineer/AGENT.md) | Architecture, business logic, APIs, validation, databases, security, and maintainability |
| [Senior Next.js Production Engineer](./nextjs-production-engineer/AGENT.md) | App Router implementation, rendering, performance, reliability, deployment, and regression checks |
| [Senior UI/UX Designer](./senior-ui-ux-designer/AGENT.md) | Visual design, interaction, accessibility, responsive behavior, design systems, and Hallmark principles |

## Invocation examples

### Senior Software Engineer

```text
Act as the Senior Software Engineer defined in .agents/senior-software-engineer/AGENT.md.
Review the recruiter API and implement server-side ownership checks without changing the UI.
```

### Senior Next.js Production Engineer

```text
Act as the Senior Next.js Production Engineer defined in .agents/nextjs-production-engineer/AGENT.md.
Diagnose the production build failure, make the smallest safe fix, and verify the build.
```

### Senior UI/UX Designer

```text
Act as the Senior UI/UX Designer in .agents/senior-ui-ux-designer/AGENT.md.
Inspect and improve the recruiter table for desktop and mobile while preserving all existing behavior.
```

## Collaboration workflow

1. The Senior Software Engineer inspects architecture and defines technical constraints.
2. The UI/UX Designer inspects the current interface and defines a practical visual direction.
3. The Next.js Production Engineer evaluates rendering, performance, and implementation constraints.
4. One primary agent owns the implementation batch. Supporting agents review only their relevant areas.
5. The relevant reviewers check the final diff, tests, build, accessibility, and regressions.
6. The owner reports unresolved issues honestly instead of claiming a production-ready result.

## Mandatory global rules

- Inspect existing files and architecture before implementation.
- Do not open, read, print, modify, or access `.env` or `.env.*` files.
- Preserve authentication, OAuth, database models, API contracts, Socket.io, AI integrations, and existing user workflows unless the task explicitly changes them.
- Do not migrate frameworks or databases without explicit approval.
- Prefer focused changes over rewrites.
- Use the existing stack and conventions before introducing dependencies.
- Validate inputs and authorization on the server.
- Never expose credentials, tokens, private keys, or internal database errors.
- Handle loading, empty, error, and permission states.
- Run relevant verification and report actual results.

## Repository-stack rule

For a SoulBridge repository, preserve the existing Next.js App Router, JavaScript, Prisma, MongoDB, Tailwind, NextAuth, Socket.io, and Groq conventions. If a different repository is encountered, inspect `package.json` and existing code, respect that repository's discovered stack, and do not convert it to a different technology without explicit approval.

## Hallmark rule

The UI/UX agent must locate and read the installed Hallmark `SKILL.md` before any new or redesigned interface work. Existing UI changes should follow the project's own design system unless the task explicitly asks for a Hallmark redesign or audit. Never claim Hallmark was used when it was unavailable.
