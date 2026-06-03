# Artifactory — Vision & Roadmap

## What Is Artifactory?

A **general-purpose asset pipeline system** for composing transformation graphs over heterogeneous assets. Think CI/CD meets n8n, purpose-built for creative and generative AI workflows with first-class observability.

Users visually assemble pipelines by dragging adapter nodes onto a canvas, connecting typed ports, and running the graph. Every step is observable — logs, timing, inputs, outputs, errors — like watching a CI build execute.

## Why?

The WorldTree ecosystem already has image generation (Runware), 3D mesh generation (Meshy), prompt enhancement (LLM), and asset management scattered across `start-console-backend`. Artifactory generalizes all of this into a single, extensible pipeline system where:

- Any new capability is "just another adapter"
- Workflows are composable and reusable
- Every execution step is traceable
- Local and remote services plug in equally

## Core Principles

1. **Adapter-first** — New capabilities = new adapter file. No core changes needed.
2. **Observable by default** — Every execution step logs, times, and stores its inputs/outputs.
3. **Type-safe end-to-end** — Elysia types → Eden Treaty → Svelte components. No guessing.
4. **Assets are first-class** — Everything is a typed Asset with metadata, not just files on disk.
5. **Pipeline as code** — Pipeline definitions are serializable JSON. Import, export, version.
6. **Progressive complexity** — Simple pipelines should be trivial. Complex multi-step workflows should be possible.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  SvelteKit Frontend              │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Pipeline    │ │  Asset   │ │  Run         │  │
│  │  Editor      │ │  Library │ │  Observer    │  │
│  └─────────────┘ └──────────┘ └──────────────┘  │
│                Eden Treaty (type-safe)            │
├─────────────────────────────────────────────────┤
│                  ElysiaJS API                    │
│  /api/assets  /api/pipelines  /api/runs          │
│  /api/adapters  /api/storage                     │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │  Adapter  │  │  Pipeline │  │  Storage     │  │
│  │  Registry │  │  Engine   │  │  Service     │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│                                                   │
│  Adapters:                                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐  │
│  │Manual  │ │Image   │ │Meshy   │ │ComfyUI   │  │
│  │Upload  │ │Gen     │ │3D      │ │Instance  │  │
│  └────────┘ └────────┘ └────────┘ └──────────┘  │
├─────────────────────────────────────────────────┤
│  Drizzle ORM + SQLite/libSQL                     │
│  Local Filesystem Storage (→ S3/Minio later)     │
└─────────────────────────────────────────────────┘
```

## Milestones

### Phase 1 — Foundation ✅ (complete)
- [x] Database schema (6 tables: assets, pipelines, nodes, edges, runs, node_runs)
- [x] Adapter interface + registry + ManualUploadAdapter
- [x] Full API (20+ endpoints: assets, pipelines, nodes, edges, runs, adapters, storage)
- [x] Pipeline engine (DAG topological sort, sequential execution, fail-fast, observability)
- [x] StorageService (local filesystem, swappable interface)
- [x] 14 unit tests passing, type-check clean, build succeeds

### Phase 2 — UI Foundation (next)
- [ ] Pipeline editor canvas — visual DAG editor with drag-and-drop nodes
- [ ] Node palette — sidebar listing available adapters
- [ ] Node inspector — click a node to configure adapter settings
- [ ] Port connections — drag from output port to input port
- [ ] Edge validation — visual indicators for type mismatches
- [ ] Run trigger — button to execute a pipeline
- [ ] Run observer — live status overlay on the DAG (green/red/yellow/gray per node)
- [ ] Asset library — grid view, upload, inline preview

### Phase 3 — Real Adapters
- [ ] Image generation adapter (Runware — ported from start-console-backend)
- [ ] Mesh generation adapter (Meshy — ported from start-console-backend)
- [ ] Prompt enhancement adapter (LLM-based)
- [ ] ComfyUI instance adapter (local image gen via WebSocket API)
- [ ] Image resize/format transform adapter
- [ ] Video parse adapter (frame extraction)

### Phase 4 — Advanced Engine
- [ ] Parallel branch execution (independent DAG branches run concurrently)
- [ ] Retry policies per node (configurable max retries, backoff)
- [ ] Pipeline templates (save and instantiate common patterns)
- [ ] Scheduled runs (cron-like triggers)
- [ ] Webhook triggers (external systems kick off pipelines)
- [ ] Pipeline versioning (track changes over time)

### Phase 5 — Production Hardening
- [ ] Auth integration on API routes (Better Auth middleware on Elysia)
- [ ] S3/Minio storage backend (swap out LocalStorageService)
- [ ] Asset cleanup policies (TTL, max storage)
- [ ] Rate limiting on generation adapters
- [ ] WebSocket or SSE for live run updates (replace polling)
- [ ] Pipeline import/export (JSON serialization)

## Known Caveats

### Current Limitations
- **Sequential execution only** — DAG branches run one node at a time in topological order. Independent branches don't parallelize yet.
- **Fire-and-forget runs** — `POST /pipelines/:id/run` spawns an async task and returns immediately. This works on adapter-node but won't survive serverless deployments or server restarts. No job queue.
- **No auth on API routes** — Better Auth is scaffolded and the hooks are set up, but Elysia routes are not gated. All endpoints are open.
- **Single adapter** — Only ManualUploadAdapter exists. No generative adapters yet.
- **No real-time updates** — Clients must poll `GET /runs/:runId` for status. No WebSocket/SSE push.
- **Local storage only** — Blobs stored on local filesystem at `./storage/`. No S3/Minio.
- **SQLite limitations** — Single-writer, file-based. Fine for single-user/dev, not for concurrent production workloads without migration to libSQL server mode or Postgres.

### Technical Decisions Worth Revisiting
- **Adapter registry is in-memory** — Works well for built-in adapters. If we want user-defined adapters (plugin marketplace), we'll need a hybrid approach.
- **Elysia `.use()` chaining** — Eden Treaty infers types from the full chain. If type inference ever breaks on deeply nested route groups, we may need to restructure.
- **Timestamps as integers** — Drizzle SQLite uses `integer({ mode: 'timestamp' })`. Works but means all timestamps are second-precision (not millisecond).
- **No soft deletes** — Assets, pipelines, runs are hard-deleted. May want soft deletes for audit trail later.

### Elysia-Specific Gotchas
- **Error responses**: Use `import { status } from 'elysia/error'` — NOT `error` from context or as a named export from `'elysia'`.
- **`type App = typeof app`** must be at the bottom of `api/index.ts` after all `.use()` calls for Eden Treaty to infer all routes.

## Inspiration Sources

- **start-console-backend** — Job state machine, provider adapters (Runware/Meshy/OpenAI), Minio storage patterns
- **Dreamball** — Backend interface pattern (minimal contract, swappable impls), lens/renderer pattern for extensible UI
- **n8n** — Visual workflow builder, node-based composition UI
- **GitHub Actions / CI** — DAG execution model, run observability, status tracking
- **ComfyUI** — Node-based generative AI workflow (but we want better UX and observability)
