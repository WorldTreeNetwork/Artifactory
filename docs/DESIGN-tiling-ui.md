# Tiling Pipeline UI — Design Document

## Overview

Artifactory's pipeline editor uses a **tiling layout** rather than a freeform node graph. Inspired by tiling window managers (niri, Hyprland, i3), the UI auto-arranges pipeline steps in a structured, scrollable flow. Users focus on *what* to do, not *where to put things*.

## Design Goals

1. **No spaghetti** — connections are implicit via adjacency and grouping, not freeform wires
2. **Auto-layout** — steps arrange themselves; no manual positioning for the common case
3. **Schema-visible** — input/output types are prominent on each tile, not hidden in config panels
4. **Scrolling expansion** — pipelines grow horizontally (niri-style), no fixed canvas
5. **Fan-out/fan-in native** — parallel branches are a first-class layout concept, not an afterthought
6. **Responsive** — works on different screen sizes; tiles reflow gracefully
7. **Observable** — during runs, each tile shows live status without a separate view

## Layout Model

### Flow Direction

Primary flow is **left-to-right**. Each step occupies a **column**. The viewport scrolls horizontally as the pipeline grows, similar to how niri expands workspaces.

```
  Column 0        Column 1        Column 2          Column 3
┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌────────────┐
│            │  │            │  │ ┌──────────┐ │  │            │
│  Source    │─▶│  Transform │─▶│ │ Branch A │ │─▶│  Sink      │
│            │  │            │  │ ├──────────┤ │  │            │
│            │  │            │  │ │ Branch B │ │  │            │
│            │  │            │  │ └──────────┘ │  │            │
└────────────┘  └────────────┘  └──────────────┘  └────────────┘
```

### Tile Types

#### 1. Step Tile (single node)
The primary unit. Shows one adapter node.

```
┌─ Image Generator ──────────────────┐
│  category: generator          ● ok │  ← status dot (idle/running/done/error)
│                                    │
│  IN                                │
│  ┌─ prompt ──────────────────────┐ │
│  │ text/plain                    │ │  ← port with type badge
│  └───────────────────────────────┘ │
│                                    │
│  OUT                               │
│  ┌─ image ───────────────────────┐ │
│  │ { url: string,               │ │  ← schema preview (collapsed TypeScript)
│  │   width: number,             │ │
│  │   height: number }           │ │
│  └───────────────────────────────┘ │
│                                    │
│  Config: model=flux, size=1024x..  │  ← summary line
└────────────────────────────────────┘
```

#### 2. Group Tile (fan-out container)
When a step fans out to multiple parallel branches, they're grouped in a vertical stack within a single column.

```
┌─ Parallel ─────────────────────────┐
│  ┌─ Image Gen (Runware) ─────────┐ │
│  │  IN: image    OUT: image      │ │
│  └───────────────────────────────┘ │
│  ┌─ Mesh Gen (Meshy) ───────────┐ │
│  │  IN: image    OUT: model/glb  │ │
│  └───────────────────────────────┘ │
│  ┌─ Metadata Extract ───────────┐ │
│  │  IN: image    OUT: json       │ │
│  └───────────────────────────────┘ │
└────────────────────────────────────┘
```

#### 3. Merge Tile (fan-in)
Collects outputs from parallel branches. Shows which inputs map to which upstream outputs.

```
┌─ Collect Results ──────────────────┐
│  IN                                │
│  ┌─ image ← Image Gen.image ────┐ │  ← shows source mapping
│  ┌─ mesh  ← Mesh Gen.model ─────┐ │
│  ┌─ meta  ← Metadata.json ──────┐ │
│                                    │
│  OUT                               │
│  ┌─ bundle ─────────────────────┐ │
│  │ { image: ImageOut,           │ │
│  │   mesh: MeshOut,             │ │
│  │   meta: MetaOut }            │ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
```

### Adding Steps

Steps are added via a **command palette** (Cmd+K / Ctrl+K) or a sidebar catalog. When adding:

1. Select an adapter from the catalog
2. Step is inserted after the currently selected tile (or at the end)
3. If inserting between two tiles, connections are automatically re-wired
4. Layout adjusts — no manual repositioning needed

### Connections

Connections between adjacent tiles are **implicit** — the output of column N feeds the input of column N+1. Users only need to explicitly configure connections when:

- A tile has multiple input ports and the mapping is ambiguous
- A fan-in tile collects from multiple upstream branches
- A step needs input from a non-adjacent upstream step (long-range connection, shown as a labeled reference rather than a wire)

For the common linear case, it just flows.

### Selection & Configuration

- **Click a tile** → expands inline or opens a side panel with full config
- **Tile config** includes: adapter settings (JSON form generated from configSchema), port mapping overrides, retry policy, label
- **Double-click a port schema** → expands to full type definition with field descriptions

## Schema System

### Port Schemas (TypeBox)

Each adapter port carries a TypeBox schema for its data shape:

```typescript
import { t } from 'elysia';

const imageGenAdapter: Adapter = {
  outputPorts: [{
    name: 'image',
    mimeTypes: ['image/png'],
    schema: t.Object({
      url: t.String({ description: 'CDN URL of the generated image' }),
      width: t.Number(),
      height: t.Number(),
      format: t.Union([t.Literal('png'), t.Literal('webp')]),
      prompt: t.String({ description: 'The prompt that generated this image' }),
      seed: t.Optional(t.Number())
    })
  }]
};
```

Schemas serve triple duty:
1. **Runtime** — Elysia validates adapter outputs against the schema
2. **Visual** — tiles render a collapsed TypeScript-like preview of the type
3. **Export** — schemas compile to portable `.ts` type files and API client types

### Schema Display Modes

On tiles, schemas render in three levels of detail:

**Collapsed** (default): `{ url, width, height, format, prompt }`
**Summary**: Shows types: `{ url: string, width: number, height: number, ... }`
**Expanded**: Full TypeScript interface with descriptions (on click/hover)

### Portable Type Export

`GET /api/pipelines/:id/schema` returns a `.ts` file:

```typescript
// Auto-generated by Artifactory
// Pipeline: "Product Image Pipeline" (abc-123)

export interface PromptEnhanceOutput {
  text: string;
}

export interface ImageGenOutput {
  url: string;
  width: number;
  height: number;
  format: 'png' | 'webp';
  prompt: string;
  seed?: number;
}

export interface MeshGenOutput {
  glbUrl: string;
  printUrl: string;
  vertexCount: number;
  validation: {
    watertight: boolean;
    manifold: boolean;
  };
}

export interface PipelineOutputs {
  promptEnhance: PromptEnhanceOutput;
  imageGen: ImageGenOutput;
  meshGen: MeshGenOutput;
}
```

### API Client Generation

External TS/JS apps can consume pipeline outputs with full type safety:

```typescript
import { createClient } from '@worldtree/artifactory-client';

const client = createClient({ baseUrl: 'https://artifactory.example.com', apiKey: '...' });

// Trigger a run
const run = await client.pipelines['product-image'].run({
  inputs: { upload: { assetId: 'abc' } }
});

// Poll for results — fully typed
const result = await run.waitForCompletion();
console.log(result.outputs.imageGen.url);    // string
console.log(result.outputs.meshGen.glbUrl);  // string
```

## Run Observation

During a pipeline run, the tiling view becomes a **live dashboard**:

### Tile Status States

| State | Visual |
|-------|--------|
| Idle | Default tile appearance |
| Pending | Subtle pulse/shimmer, gray status dot |
| Running | Highlighted border (blue/indigo), animated status dot |
| Completed | Green status dot, shows duration badge |
| Failed | Red border, red status dot, error message inline |
| Skipped | Dimmed/muted, gray strikethrough |

### Status Bar

A thin bar runs along the bottom of the pipeline view:

```
Run #47 ─── ●●●○○ 3/5 nodes ─── 12.4s elapsed ─── running
```

### Log Drawer

Click a completed/failed tile to expand a **log drawer** below it showing structured log entries from that node's execution.

## Page Structure

```
/                       → Landing page (link to /pipelines)
/pipelines              → Pipeline list (cards, create new)
/pipelines/:id          → Pipeline editor (tiling view)
/pipelines/:id/runs     → Run history for a pipeline
/pipelines/:id/runs/:r  → Run detail (tiling view with status overlay)
/assets                 → Asset library (grid, upload, preview)
```

## Component Architecture

```
PipelineEditor
├── PipelineToolbar        (name, status, run button, settings)
├── TilingCanvas           (horizontal scroll container)
│   ├── StepColumn         (one per pipeline column)
│   │   ├── StepTile       (single adapter node)
│   │   │   ├── PortBadge  (input/output with schema preview)
│   │   │   └── ConfigSummary
│   │   └── GroupTile      (fan-out container, stacks StepTiles vertically)
│   └── AddStepHandle      (+ button between columns)
├── StepInspector          (side panel: full config, schema detail)
└── CommandPalette         (Cmd+K: add adapter, search, actions)
```

## CSS Strategy

- **CSS Grid** for the tiling layout (not Canvas/SVG)
- `grid-auto-flow: column` with `grid-auto-columns: minmax(280px, 380px)`
- `overflow-x: auto` for horizontal scroll
- Fan-out groups use nested `grid-template-rows`
- Tailwind utility classes for all styling
- Transitions for status changes, tile insertion/removal
- `scroll-snap-type: x mandatory` for column snapping (optional, test feel)

## Authentication (Future: Identikey)

- Landing page (`/`) is public
- `/pipelines/**` routes will require authentication via Identikey
- Auth gate implemented as a SvelteKit `+layout.server.ts` load guard
- Placeholder: currently open, auth middleware added when Identikey integration is ready

## Open Questions

1. **Reordering** — Should tiles be drag-to-reorder within the flow? Or only add/remove?
2. **Long-range connections** — How to visually indicate when a tile references a non-adjacent upstream output? Labeled badges? Dotted underlines?
3. **Nested pipelines** — Should a pipeline be usable as an adapter inside another pipeline? (Pipeline-as-node)
4. **Mobile** — Tiling could reflow to vertical on narrow screens. Worth supporting?
5. **Keyboard navigation** — Arrow keys to move between tiles, Enter to expand, Escape to collapse?
6. **Dark/light mode** — Start dark-only (matches landing page) or support both?
