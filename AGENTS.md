# Repository Guidelines

## Project Structure & Module Organization
Core Next.js app lives in `src/app`; UI primitives sit in `src/components`, and shared logic lives in `src/lib`, `src/shared`, and `src/hooks`. Prisma schema files reside in `prisma`, while database helpers and seeds are in `scripts` and `infra/migration`. Static assets stay in `public`, supplemental references in `docs`, and feature state modules in `src/stores`. Sample data should remain in `src/data` to keep migrations deterministic.

## Build, Test, and Development Commands
- `npm run dev` starts the Next.js dev server with hot reload.
- `npm run build` generates Prisma client code, type-checks, and produces the production bundle.
- `npm start` serves the built app; use `npm run build:quick` when you only need the Next.js output.
- `npm run lint` / `npm run lint:fix` enforce ESLint; `npm run format` or `npm run format:check` apply Prettier.
- `npm run db:setup` bootstraps the local database; `npm run migrate` executes the migration harness in `infra/migration`.
- `npm run docker:dev` spins up the full stack via Docker Compose when local dependencies are missing.

## Coding Style & Naming Conventions
Use TypeScript ES modules and prefer React Server Components under `src/app`. Prettier controls formatting—avoid manual spacing tweaks and run it before committing. Tailwind utilities should stay composable, with `class-variance-authority` handling complex variants. Use PascalCase for components, camelCase for general exports, and SCREAMING_SNAKE_CASE for environment constants. Share cross-domain types from `src/types` to prevent import cycles.

## Testing Guidelines
Vitest provides unit coverage; co-locate specs near their logic (e.g., `src/lib/__tests__/priceEstimator.test.ts`). Run `npm run test` during development and `npm run test:run` in CI scripts. Reach for `npm run test:integration` when touching API routes or Prisma flows, and `npm run test:smoke` before shipping changes that affect customer workflows.

## Commit & Pull Request Guidelines
Write imperative commit subjects (e.g., "Add pricing estimator guards") and keep each commit focused. Reference tickets with `[#123]` where applicable. Pull requests should explain intent, note risks, list verification commands, and attach UI screenshots when visuals change. Request review from a domain owner and call out any required updates in `docs/`.

## Security & Configuration Tips
Load secrets from `.env.local`; never commit `.env*`. After schema edits, regenerate the client via `npm run db:setup`. Background jobs rely on Redis (`REDIS_URL`) and the worker entry point at `npm run worker`—confirm credentials before launching them.
