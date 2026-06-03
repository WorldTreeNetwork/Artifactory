# Tasks: Pipeline Editor

Ordered by vertical slice — each task produces something usable or visible. Dependencies flow downward.

---

## Foundation Layer

- [ ] **1. Design tokens CSS** — Implement all tokens from DESIGN_TOKENS.md as CSS custom properties in `layout.css` with `@theme` block. Dark/light mode via `.dark` class or `prefers-color-scheme`. Validate Tailwind picks them up.

- [ ] **2. App shell + navigation** — Slim sidebar (collapsed icon nav), top toolbar area, main content slot, detail drawer slot. Route layout at `(app)/+layout.svelte` wrapping all authenticated pages. Dark/light theme toggle wired to a store.

- [ ] **3. Pipeline list page** — `/pipelines` route. Card grid of pipelines from API (name, status badge, node count, last updated). Create new button → creates pipeline via API, navigates to editor. Empty state. Filter by status.

---

## Viewport & Tiles

- [ ] **4. Zoomable viewport** — Svelte component wrapping a `<div>` with d3-zoom (or equivalent). Pan with drag, zoom with scroll/pinch. Exposes `zoom` level as a reactive value. Canvas background with dot grid pattern.

- [ ] **5. StepTile component** — Single adapter node tile. Category color left border + subtle bg tint. Adapter name, category badge, status dot. Input/output port badges with type colors. LOD: 3 detail levels driven by a `zoomLevel` prop (overview/working/detail). Fixed width, auto height.

- [ ] **6. PortBadge component** — Port name + type color pill. At detail zoom: shows schema fields as key-value type pills. Connected/unconnected visual state. Renders a DOM anchor point for wire attachment (data attribute with port coordinates).

- [ ] **7. Tiling layout engine** — Given an array of nodes and edges, compute tile positions in a 2D grid. Horizontal columns by topological order. Vertical stacking for fan-out groups. Returns `{ nodeId, x, y, column, row }[]`. Pure function, no DOM — just math. Unit testable.

- [ ] **8. Render pipeline in viewport** — Wire together: load pipeline from API → layout engine computes positions → viewport renders StepTiles at computed positions. Tiles are absolutely positioned DOM elements inside the viewport's transform container. Pan/zoom works with tiles.

---

## Wires & Connections

- [ ] **9. Wire layer (SVG beziers)** — SVG overlay inside the viewport. For each edge, draw a bezier curve from source port anchor to target port anchor. Color by port type. Wire tokens (width, opacity, dash for mismatch). Recalculates on viewport transform and tile position changes.

- [ ] **10. Port interaction + auto-connect** — Click a port to start a connection drag. Show a preview wire following the cursor. Drop on a compatible port to create an edge (API call). Auto-match: when adding a tile, auto-create edges where port types are compatible with the previous tile. Highlight compatible ports during drag.

---

## Interaction Layer

- [ ] **11. Tile selection + detail drawer** — Click a tile → selected state (highlight border, raised shadow). Bottom/right drawer slides open with: adapter config form (generated from `configSchema`), port list with connection details, label edit. Drawer closes on Escape or clicking canvas.

- [ ] **12. Command palette** — Cmd+K / Ctrl+K opens a floating search panel. Lists all adapters from API, searchable by name/category. Select an adapter → inserts a new node after the selected tile (or at end). Closes on Escape or selection.

- [ ] **13. Add/remove tiles** — Insertion handles (`+` buttons) between columns, visible on hover. Click → opens adapter picker (mini command palette inline). Delete tile via drawer action or keyboard Delete key. API calls to create/delete nodes, re-layout after mutation.

- [ ] **14. Fan-out (group tile)** — "Add parallel branch" action on a tile's output port context menu. Creates a GroupTile container in the next column. GroupTile stacks child StepTiles vertically. Layout engine handles group sizing. Edges fan from source to each child.

---

## Run Observation

- [ ] **15. Run trigger + status bar** — "Run" button in toolbar. Calls `POST /pipelines/:id/run`. Status bar appears at bottom: run ID, progress dots, elapsed time, overall status. Polls `GET /runs/:runId` on interval for updates.

- [ ] **16. Live tile status overlay** — During a run, tiles reflect node_run status: pending pulse, running glow border, completed green dot + duration badge, failed red border + inline error. Status transitions animate using the animation tokens. Skipped tiles dim.

- [ ] **17. Run detail + log drawer** — `/pipelines/:id/runs/:runId` route renders the same pipeline canvas but read-only with status overlay baked in. Click a tile → drawer shows structured logs (from `node_runs.logs`), input/output asset IDs, timing breakdown, error details.

---

## Supporting Pages

- [ ] **18. Asset library page** — `/assets` route. Grid of asset cards (thumbnail/icon, name, mime type badge, size). Upload zone (drag-and-drop). Filter by mime type category. Click → asset detail with full preview (image render, text display, JSON tree).

- [ ] **19. Adapter catalog page** — `/adapters` route. Card grid grouped by category. Each card: name, description, category badge, port count. Click → detail view with full port definitions, config schema docs, usage in pipelines.

- [ ] **20. Run history page** — `/pipelines/:id/runs` route. Table of runs (number, status badge, trigger, started, duration). Click row → run detail. Filter by status. Cancel button for active runs.

---

## Polish & Schema

- [ ] **21. Minimap** — Small overview panel (bottom-right of viewport). Renders a simplified view of the full pipeline shape (colored rectangles for tiles, lines for wires). Shows viewport position as a draggable rectangle. Click to navigate.

- [ ] **22. Schema explorer page** — `/pipelines/:id/schema` route. Visual type graph showing each step's input/output schemas. Click a type → full definition panel. Export buttons: "Copy as TypeScript", "Download .ts", "Copy JSON Schema". Requires adding `GET /api/pipelines/:id/schema` endpoint.

- [ ] **23. Schema on ports** — Upgrade adapter port definitions to include TypeBox schemas (beyond just mime types). Update ManualUploadAdapter. Schema data flows through API → tile PortBadge renders field pills at detail zoom. Backend + frontend change.

---

## Deferred (not in this build phase)

- [ ] Keyboard navigation (arrow keys between tiles)
- [ ] Tile drag-to-reorder within the flow
- [ ] Long-range connections (non-adjacent tile references)
- [ ] MergeTile implementation (fan-in)
- [ ] Pipeline settings page
- [ ] Global run history (`/runs`)
- [ ] User settings page
- [ ] Identikey auth integration
