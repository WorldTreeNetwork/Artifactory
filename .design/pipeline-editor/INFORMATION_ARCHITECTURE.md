# Information Architecture: Artifactory

## Navigation Model

### Primary Navigation

Top-level nav is a **slim sidebar** (collapsed by default, icon-only) or **top bar** — minimal chrome, maximum canvas space for the editor.

```
┌──┬──────────────────────────────────────┐
│  │                                      │
│ P│          Main Content Area           │
│ A│                                      │
│ L│                                      │
│  │                                      │
│  │                                      │
├──┴──────────────────────────────────────┤
│              Detail Drawer              │
└─────────────────────────────────────────┘
```

**Nav items (icon + label on hover/expand):**

| Icon | Label | Route | Purpose |
|------|-------|-------|---------|
| Grid/Flow | Pipelines | `/pipelines` | Pipeline list and editor |
| Box | Assets | `/assets` | Asset library |
| Plug | Adapters | `/adapters` | Browse available adapters |
| Activity | Runs | `/runs` | Global run history |
| Settings | Settings | `/settings` | User/system settings |

The nav collapses to icons when the editor is active to maximize canvas real estate. On pipeline list/asset pages it can expand.

### Contextual Navigation

When inside a pipeline (`/pipelines/:id`), a **breadcrumb + tabs** pattern appears:

```
Pipelines > My Pipeline                    [Draft ▾]  [▶ Run]  [⚙]
──────────────────────────────────────────────────────────
  Editor    Runs    Schema    Settings
```

---

## URL Structure

```
/                                   Landing (public)
│
├── /pipelines                      Pipeline list
│   ├── /pipelines/new              Create new pipeline
│   └── /pipelines/:id              Pipeline detail
│       ├── /pipelines/:id          Editor (default tab)
│       ├── /pipelines/:id/runs     Run history
│       │   └── /pipelines/:id/runs/:runId   Run detail (editor with status overlay)
│       ├── /pipelines/:id/schema   Schema explorer / type export
│       └── /pipelines/:id/settings Pipeline settings (name, description, status)
│
├── /assets                         Asset library
│   └── /assets/:id                 Asset detail / preview
│
├── /adapters                       Adapter catalog (browse, docs)
│   └── /adapters/:id               Adapter detail (ports, schema, config docs)
│
├── /runs                           Global run history (across all pipelines)
│   └── /runs/:runId                Run detail (redirects to pipeline context)
│
└── /settings                       User/system settings
```

### URL Design Principles

- **Pipelines are the primary object** — most routes nest under `/pipelines/:id`
- **Runs are accessible both globally** (`/runs`) and scoped to a pipeline (`/pipelines/:id/runs`)
- **Schema has its own route** — it's a first-class concept, not buried in settings
- **No deep nesting** beyond 3 levels — keeps URLs readable and shareable

---

## Page Inventory

### 1. Landing Page (`/`)

**Purpose**: Entry point, directs to the app.
**Content**: Product name, one-liner, "Open Pipeline Editor" CTA.
**Auth**: Public.
**Status**: Built.

### 2. Pipeline List (`/pipelines`)

**Purpose**: Browse, search, and manage pipelines.
**Content**:
- Card grid of pipelines (name, status badge, node count, last run status, updated date)
- Create new button (top right)
- Filter bar: status (draft/active/archived), search by name
- Empty state: illustration + "Create your first pipeline"
**Actions**: Create, open, duplicate, archive, delete
**Auth**: Required (Identikey, when ready)

### 3. Pipeline Editor (`/pipelines/:id`)

**Purpose**: The core experience — build and configure pipelines.
**Content**:
- Toolbar: pipeline name (editable), status badge + dropdown, Run button, settings gear
- Tabs: Editor | Runs | Schema | Settings
- Viewport: zoomable/pannable canvas with tiling grid, SVG wires, minimap
- Command palette (Cmd+K): adapter search, actions
- Detail drawer (bottom/right): tile config, schema detail, port mapping, logs
**Actions**: Add/remove/reorder tiles, connect ports, configure adapters, run pipeline
**Auth**: Required

### 4. Run History (`/pipelines/:id/runs`)

**Purpose**: View past and active runs for a pipeline.
**Content**:
- Table: run number, status, trigger type, started, duration, node summary
- Click a row → navigates to run detail
- Active runs show live status with progress indicator
- Filter: status, date range
**Actions**: View detail, cancel active run, re-run

### 5. Run Detail (`/pipelines/:id/runs/:runId`)

**Purpose**: Observe a specific pipeline execution.
**Content**:
- Same tiling canvas as the editor, but **read-only with status overlay**
- Each tile shows: status color, duration badge, output asset thumbnails
- Click a tile → drawer shows: structured logs, input/output assets, timing breakdown, error details
- Status bar at bottom: run progress, elapsed time, overall status
**Actions**: Cancel (if running), re-run, download output assets

### 6. Schema Explorer (`/pipelines/:id/schema`)

**Purpose**: View and export the pipeline's type graph.
**Content**:
- Visual schema map: each pipeline step with its input/output types displayed
- Type detail panel: click a type to see full definition
- Export controls: "Copy as TypeScript", "Download .ts", "Copy JSON Schema"
- Compatibility checker: paste a type, see which steps it's compatible with
**Actions**: Export types, check compatibility

### 7. Asset Library (`/assets`)

**Purpose**: Browse, upload, and manage assets.
**Content**:
- Grid/list toggle
- Filter bar: mime type category (images, video, 3D, text, other), search
- Upload zone: drag-and-drop area (always visible at top or as empty state)
- Asset cards: thumbnail/icon, filename, mime type badge, size, date
- Click → asset detail
**Actions**: Upload, preview, download, delete, use in pipeline

### 8. Asset Detail (`/assets/:id`)

**Purpose**: Preview and inspect a single asset.
**Content**:
- Full preview (image render, 3D viewer, video player, text/code display, JSON tree)
- Metadata panel: mime type, size, created date, source pipeline/node (if generated)
- Usage panel: which pipelines/nodes reference this asset
**Actions**: Download, delete, open source pipeline

### 9. Adapter Catalog (`/adapters`)

**Purpose**: Browse available adapters and their documentation.
**Content**:
- Card grid grouped by category (source, generator, transformer, analyzer, sink)
- Each card: adapter name, description, category badge, port summary
- Search/filter by category, name
- Click → adapter detail
**Actions**: Browse, search, view details

### 10. Adapter Detail (`/adapters/:id`)

**Purpose**: Full documentation for a specific adapter.
**Content**:
- Description, category
- Input ports: name, accepted types, required/optional, schema
- Output ports: name, produced types, schema
- Config schema: rendered as a documented form showing all options
- Usage: which pipelines use this adapter
**Actions**: View docs, add to a pipeline (links to editor)

### 11. Global Run History (`/runs`)

**Purpose**: See all runs across all pipelines.
**Content**:
- Same table as pipeline-scoped runs but with pipeline name column
- Filter: pipeline, status, date range
- Click → navigates to pipeline-scoped run detail
**Actions**: View detail, filter

### 12. Settings (`/settings`)

**Purpose**: User and system configuration.
**Content**:
- Theme toggle (dark/light)
- Editor preferences: default insert behavior (insert vs append), zoom defaults
- API keys / integrations (when adapter auth is needed)
- Storage settings (future: switch storage backend)
**Auth**: Required

---

## User Flows

### Flow 1: Create and Run a Simple Pipeline

```
/pipelines
  → Click "New Pipeline"
  → /pipelines/new → enters name → redirects to /pipelines/:id (editor)
  → Cmd+K → search "upload" → add Manual Upload tile
  → Cmd+K → search "image" → add Image Generator tile
  → Wires auto-connect (upload output → image gen input)
  → Click Image Gen tile → drawer opens → configure model, size
  → Click Manual Upload tile → drawer opens → attach an asset
  → Toolbar: change status to "Active"
  → Click "▶ Run"
  → Tiles animate: pending → running → completed
  → Status bar: "Run #1 — ●● 2/2 — 3.2s — completed"
  → Click Image Gen tile → drawer shows output image thumbnail + logs
```

### Flow 2: View Run Results and Export Schema

```
/pipelines/:id → Runs tab
  → /pipelines/:id/runs → see list of runs
  → Click latest run → /pipelines/:id/runs/:runId
  → Read-only canvas with status overlay
  → Click a completed tile → drawer shows logs, output assets
  → Click output asset thumbnail → opens in asset detail
  → Back to pipeline → Schema tab
  → /pipelines/:id/schema → see type graph
  → Click "Copy as TypeScript" → clipboard has .ts types
```

### Flow 3: Build a Fan-Out Pipeline

```
/pipelines/:id (editor)
  → Add source tile (Manual Upload)
  → Add transform tile (Prompt Enhance)
  → Wires auto-connect
  → Click Prompt Enhance output port → "Add parallel branch"
  → Group tile appears in next column
  → Add Image Gen inside group
  → Add Mesh Gen inside group (stacks vertically)
  → Add a Merge/Collect tile after the group
  → Wires: Prompt Enhance → both branches, both branches → Merge
  → Each branch runs in parallel (when engine supports it)
```

### Flow 4: Upload and Browse Assets

```
/assets
  → Drag files onto upload zone
  → Assets appear in grid with thumbnails
  → Filter by "Images" → see only image assets
  → Click an image → /assets/:id → full preview
  → See "Source: Image Gen Pipeline, Run #3" → click → opens run detail
```

---

## Content Hierarchy (by importance)

### Pipeline Editor (primary)
The editor IS the app. Everything else supports it.

### Supporting Views (secondary)
- Run observation (runs tab, run detail)
- Asset library (inputs and outputs)
- Schema explorer (type export, compatibility)

### Reference Views (tertiary)
- Adapter catalog (documentation)
- Settings
- Global run history

### Entry Points (shell)
- Landing page
- Pipeline list

---

## State Management Patterns

### URL as Source of Truth
- Current pipeline: `:id` in URL
- Current tab: URL path (`/runs`, `/schema`, `/settings`)
- Current run: `:runId` in URL
- Filter/search state: URL query params (`?status=active&q=image`)

### Client State (Svelte stores)
- Selected tile ID
- Drawer open/closed and current content
- Viewport position (zoom, pan offset)
- Command palette open/closed
- Unsaved changes indicator

### Server State (API via Eden Treaty)
- Pipeline data (nodes, edges, config)
- Run status and logs
- Asset list and metadata
- Adapter registry

### Optimistic Updates
- Adding/removing tiles updates the canvas immediately, API call in background
- Configuration changes save on drawer close or explicit save
- Run status polls on interval (future: SSE/WebSocket)
