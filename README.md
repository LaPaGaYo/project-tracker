# The Platform Foundation

This repository now hosts the Phase 1 monorepo foundation for **The Platform**, a project management system for software teams.

## Workspace Layout

```text
apps/web        Next.js 15 app router application
apps/worker     Background worker placeholder
packages/db     Drizzle ORM schema plus Postgres and Redis clients
packages/shared Shared types and constants
```

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run db:generate
```

## Local Services

Use Docker Compose to start the supporting infrastructure:

```bash
docker compose up -d
```

Copy `.env.example` to `.env` before running the apps locally. The checked-in defaults use `5433` for Postgres and `6380` for Redis to avoid clashing with other local stacks.
