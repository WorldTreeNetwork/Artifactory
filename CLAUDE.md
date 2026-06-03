## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth, mdsvex, storybook, mcp

## Architecture

Artifactory is a **general-purpose asset pipeline system** — a visual pipeline assembler for composing transformation graphs over heterogeneous assets (images, video, 3D, text). Think CI/CD meets n8n for creative/generative AI workflows.

### Core Concepts

- **Assets**: Typed, self-describing data (blobs or text) with metadata. Table: `assets`.
- **Pipelines**: DAGs of Nodes connected by Edges. Tables: `pipelines`, `pipeline_nodes`, `pipeline_edges`.
- **Adapters**: The plugin system. Each adapter declares typed input/output ports and an `execute()` function. Registered in-memory via `AdapterRegistry` (not DB-persisted).
- **Pipeline Runs**: Execution instances with per-node observability. Tables: `pipeline_runs`, `node_runs`.

### Key Directories

- `src/lib/server/api/routes/` — Elysia API route modules (assets, pipelines, adapters, runs, storage)
- `src/lib/server/adapters/` — Adapter interface, registry, and implementations
- `src/lib/server/engine/` — Pipeline execution engine (DAG sort, runner, logger)
- `src/lib/server/storage/` — StorageService interface + local filesystem impl
- `src/lib/server/db/` — Drizzle schema, relations, DB client

## API

- **ElysiaJS** is the API framework, mounted at `/api` via a SvelteKit catch-all route (`src/routes/api/[...slugs]/+server.ts`).
- The Elysia app is defined in `src/lib/server/api/index.ts` and exports `App` type for end-to-end type safety.
- **Eden Treaty** (`src/lib/api.ts`) is the type-safe client used on the frontend to call the API. Always use it instead of raw `fetch` for API calls.
- Add new API routes as separate files in `src/lib/server/api/routes/` and `.use()` them in `api/index.ts`.
- For error responses, use `import { status } from 'elysia/error'` — **not** `error` from context.

## Adapters

- To add a new adapter: create a file in `src/lib/server/adapters/`, implement the `Adapter` interface from `types.ts`, and register it in `index.ts`.
- Adapter categories: `source`, `generator`, `transformer`, `analyzer`, `sink`.
- Each adapter declares `inputPorts` and `outputPorts` with accepted/produced mime types.

## Database

- **Always use migrations**, never `drizzle-kit push`. Use `bun run db:generate` to create migrations and `bun run db:migrate` to apply them.
- Schema is in `src/lib/server/db/schema.ts`, relations in `relations.ts`.
- Timestamps use `integer` mode `'timestamp'` (SQLite has no native datetime).

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
