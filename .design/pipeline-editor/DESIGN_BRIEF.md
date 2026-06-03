# Design Brief: Pipeline Editor

## Project

**Artifactory** — General-purpose asset pipeline system for composing transformation graphs over heterogeneous assets. Standalone product, useful across the WorldTree ecosystem.

## Feature

The **Pipeline Editor** — the primary UI for building, configuring, and observing asset transformation pipelines.

## Users

Both technical (developers, ML engineers) and creative (artists, content creators), served through progressive disclosure. Simple operations are immediately obvious; advanced configuration reveals itself when needed.

## Design Philosophy

**Structured freedom.** Not a freeform canvas, not a rigid list. A 2D tiling grid with visible connections — auto-arranged by default, manually adjustable when needed. The UI should feel like a modern tiling window manager (niri, Hyprland) crossed with a CI pipeline view, not like yet another node graph editor.

## Conceptual Model: REA Vocabulary

The pipeline maps to REA (Resource-Event-Agent) accounting semantics from ValueFlows:

- **Resources** = Assets (typed data flowing through the pipeline)
- **Events** = Adapter executions (transformations, generations)
- **Agents** = Adapters/services doing the work

This is vocabulary and mental model for now — not a full ontology implementation. The naming and UI language should reflect these concepts where natural.

---

## Layout

### 2D Tiling Grid

- **Horizontal axis** = execution flow (left to right)
- **Vertical axis** = parallel branches and multi-port fan-out
- Tiles auto-arrange in columns. No manual positioning required for the common case.
- The viewport scrolls and zooms — pipelines expand infinitely in both directions.

### Viewport

- **DOM-based tiles** — each tile is a real Svelte component (forms, buttons, schemas all work natively)
- **Zoomable/pannable viewport** — using a zoom/pan library (d3-zoom or similar), tiles live inside it as real DOM elements
- **SVG bezier wires** — visible connections between ports, overlaid on the tile grid
- **Minimap** — small overview in corner showing the full pipeline shape

### Level of Detail (LOD)

Tiles respond to zoom level like responsive breakpoints:

| Zoom Level | Shows |
|------------|-------|
| Overview (far) | Tile name, category icon, status dot |
| Working (medium) | + port names, wire labels, config summary |
| Detail (close) | + schema preview (key-value with type pills), full config |

---

## Tiles

### Step Tile (single adapter node)

The primary unit. Displays:
- Adapter name and category badge
- Status indicator (idle/pending/running/completed/failed/skipped)
- Input ports with type badges
- Output ports with schema preview (at detail zoom)
- Config summary line

### Group Tile (fan-out container)

When a step fans out to parallel branches, they stack vertically inside a group container within one column. Created explicitly via "Add parallel branch" from a tile's output port.

### Merge Tile (fan-in)

Collects outputs from parallel branches. Shows which inputs map to which upstream outputs with labeled source references.

---

## Interactions

### Adding Steps

- **Default**: Insert after currently selected tile
- **Preference**: User can set append-to-end as default
- **Slot picking**: Mouse/modifier key to choose an insertion point between columns
- **Command palette**: Cmd+K / Ctrl+K opens adapter catalog for search and selection

### Fan-Out (Parallel Branches)

Explicit action: select a tile's output → "Add parallel branch." The column splits into a group tile automatically. Parallelism is always a deliberate choice — the linear case stays simple.

### Connections

- **Auto-match by type** — ports with compatible schemas connect automatically
- **Override** — human can force a connection even if types don't match (duck typing)
- **Structural compatibility** — if output shape is a superset of input shape, it matches
- **Visible wires** — bezier curves between ports, color-coded by port type
- **Unconnected ports** — highlighted with a distinct color, always visible

### Configuration

- **Click a tile** → bottom/right **drawer** opens with full config
- Drawer contains: adapter settings (form generated from configSchema), port mapping overrides, retry policy, label, full schema view
- Double-click a port → expands to full type definition with field descriptions

---

## Color System

Two layered color systems:

### 1. Port Type Colors (semantic)

Hand-picked colors for common data types, used on wires and port badges:

| Type | Usage |
|------|-------|
| Image | Wires carrying image data, image port badges |
| Text | Wires carrying text/prompt data |
| 3D Model | Wires carrying mesh/GLB data |
| Audio | Wires carrying audio data |
| Video | Wires carrying video data |
| JSON/Structured | Wires carrying structured metadata |
| Any/Wildcard | Wires with `*/*` type |

Exact hues defined in design tokens phase.

### 2. Tile Category Colors

Tiles are tinted by adapter category:

| Category | Meaning |
|----------|---------|
| Source | Data enters the pipeline |
| Generator | AI/ML creates new data |
| Transformer | Modifies existing data |
| Analyzer | Inspects/extracts from data |
| Sink | Data exits the pipeline |

### 3. Connection State

| State | Visual Treatment |
|-------|-----------------|
| Connected | Solid wire in port type color |
| Unconnected | Highlighted port badge (warning color) |
| Type mismatch | Dashed wire, warning indicator |
| Optional unconnected | Dimmed port badge (no warning) |

### 4. Run Status

| Status | Visual Treatment |
|--------|-----------------|
| Idle | Default tile appearance |
| Pending | Subtle pulse/shimmer, muted status dot |
| Running | Highlighted border, animated status dot |
| Completed | Success color status dot, duration badge |
| Failed | Error color border + status dot, error inline |
| Skipped | Dimmed/muted tile, strikethrough |

### Themes

Both dark and light mode from day one. Design tokens will define palettes for both.

---

## Schema System

### On Tiles

Schemas display at detail zoom level in a hybrid format:
- **Key-value layout** with field names
- **Type pills/badges** — colored tags showing the type of each field
- Example: `url` `string` · `width` `number` · `format` `'png' | 'webp'`

### Schema as API

- Adapters declare output schemas (TypeBox/JSON Schema)
- Schemas are stored, versioned, queryable
- `GET /api/pipelines/:id/schema` returns the full pipeline type graph
- Consumers can query schema data to derive their own types and check compatibility

### Portable Type Export

- Schemas compile to `.ts` type files for compile-time safety
- A runtime client lib fetches schemas at init and provides runtime-validated access (like GraphQL introspection)
- Structural/duck typing: if output shape is a superset of expected input shape, it's compatible

### Schema Inference (future)

- `POST /api/schemas/infer` accepts a data sample, returns inferred schema
- Enables custom adapters to define schemas from example outputs rather than hand-authoring

---

## Page Structure

| Route | Purpose |
|-------|---------|
| `/` | Landing page (public) — link to pipeline editor |
| `/pipelines` | Pipeline list — cards, create new, search |
| `/pipelines/:id` | Pipeline editor — tiling canvas, drawer, toolbar |
| `/pipelines/:id/runs` | Run history — table of runs with status |
| `/pipelines/:id/runs/:runId` | Run detail — tiling canvas with status overlay |
| `/assets` | Asset library — grid view, upload, preview |

## Component Architecture

```
PipelineEditor
├── PipelineToolbar         (name, status badge, run button, settings)
├── Viewport                (zoom/pan container with minimap)
│   ├── TilingGrid          (auto-layout engine positioning tiles)
│   │   ├── StepTile        (single adapter node, LOD-responsive)
│   │   │   ├── PortBadge   (input/output with type color + schema pills)
│   │   │   └── ConfigSummary
│   │   ├── GroupTile       (fan-out container, stacks children vertically)
│   │   └── MergeTile       (fan-in, shows source mappings)
│   ├── WireLayer           (SVG bezier curves between ports)
│   └── Minimap             (overview of full pipeline shape)
├── InsertionHandles        (+ buttons between columns/slots)
├── CommandPalette          (Cmd+K: adapter catalog, search, actions)
└── DetailDrawer            (bottom/right: full config, schema, logs)
```

---

## Authentication

- Landing page (`/`) is public
- `/pipelines/**` and `/assets/**` will require authentication via **Identikey** (WorldTree's auth project, in progress)
- Auth gate implemented as a SvelteKit `+layout.server.ts` load guard
- Currently open — auth middleware added when Identikey integration is ready

---

## Run Observation

During a pipeline run, the editor becomes a live dashboard:

- Tiles show real-time status (color transitions, animated indicators)
- A **status bar** at the bottom shows run progress: `Run #47 — ●●●○○ 3/5 — 12.4s — running`
- Click a completed/failed tile → drawer shows structured log entries from that node's execution
- The run detail view (`/pipelines/:id/runs/:runId`) is the same tiling canvas with status overlay, but read-only

---

## Technical Constraints

- **Stack**: SvelteKit + Svelte 5, TailwindCSS, ElysiaJS + Eden Treaty, Drizzle ORM + SQLite
- **Rendering**: DOM tiles inside zoomable viewport (d3-zoom or similar), SVG wires. Not canvas.
- **No freeform positioning**: Tiles are grid-positioned by the auto-layout engine. Users influence order and grouping, not pixel coordinates.
- **Backend exists**: Full API already built (assets, pipelines, nodes, edges, runs, adapters). Eden Treaty client at `$lib/api.ts`.

## Out of Scope (this phase)

- Full ValueFlows/REA ontology implementation
- Schema inference endpoint
- Runtime client SDK / type generation package
- Identikey authentication integration
- Scheduled/webhook pipeline triggers
- Parallel branch execution in the engine (sequential only for now)
- Mobile/responsive layout
