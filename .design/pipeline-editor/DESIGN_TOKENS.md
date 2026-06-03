# Design Tokens: Artifactory Pipeline Editor

## Implementation

Tailwind v4 with CSS custom properties. Tokens defined in `src/routes/layout.css` via `@theme` block and CSS variables on `:root` / `.dark`. Components use Tailwind utilities referencing these tokens.

---

## Color Palette

### Neutral Scale

The foundation. Used for backgrounds, text, borders, surfaces.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-bg-primary` | `#ffffff` | `#0a0a0b` | Page background |
| `--color-bg-secondary` | `#f5f5f6` | `#141416` | Sidebar, drawer background |
| `--color-bg-surface` | `#ffffff` | `#1c1c20` | Tile background, cards |
| `--color-bg-surface-hover` | `#f0f0f2` | `#24242a` | Tile hover state |
| `--color-bg-surface-selected` | `#ebebee` | `#2a2a32` | Selected tile |
| `--color-bg-canvas` | `#fafafa` | `#0e0e10` | Viewport canvas background |
| `--color-border-primary` | `#e0e0e4` | `#2a2a32` | Tile borders, dividers |
| `--color-border-subtle` | `#eeeeef` | `#1e1e24` | Inner dividers, port separators |
| `--color-border-focus` | `#6366f1` | `#818cf8` | Focus ring |
| `--color-text-primary` | `#0a0a0b` | `#f0f0f2` | Headings, tile names |
| `--color-text-secondary` | `#52525b` | `#a0a0ab` | Descriptions, config summary |
| `--color-text-muted` | `#a0a0ab` | `#5a5a66` | Timestamps, hints, disabled |
| `--color-text-inverse` | `#ffffff` | `#0a0a0b` | Text on filled badges |

### Port Type Colors (Semantic)

Color-coded wires and port badges. Each has a main color and a subtle/muted variant for backgrounds.

| Token | Light | Dark | Type |
|-------|-------|------|------|
| `--color-port-image` | `#a855f7` | `#c084fc` | Images (purple) |
| `--color-port-image-subtle` | `#f3e8ff` | `#2e1065` | Image port badge bg |
| `--color-port-text` | `#3b82f6` | `#60a5fa` | Text/prompts (blue) |
| `--color-port-text-subtle` | `#dbeafe` | `#172554` | Text port badge bg |
| `--color-port-model` | `#10b981` | `#34d399` | 3D models (green) |
| `--color-port-model-subtle` | `#d1fae5` | `#052e16` | Model port badge bg |
| `--color-port-audio` | `#f59e0b` | `#fbbf24` | Audio (amber) |
| `--color-port-audio-subtle` | `#fef3c7` | `#451a03` | Audio port badge bg |
| `--color-port-video` | `#ef4444` | `#f87171` | Video (red) |
| `--color-port-video-subtle` | `#fee2e2` | `#450a0a` | Video port badge bg |
| `--color-port-structured` | `#06b6d4` | `#22d3ee` | JSON/structured (cyan) |
| `--color-port-structured-subtle` | `#cffafe` | `#083344` | Structured port badge bg |
| `--color-port-any` | `#78716c` | `#a8a29e` | Wildcard `*/*` (stone) |
| `--color-port-any-subtle` | `#f5f5f4` | `#1c1917` | Any port badge bg |

### Adapter Category Colors

Tile tinting by category. Subtle bg tint + left border accent.

| Token | Light | Dark | Category |
|-------|-------|------|----------|
| `--color-cat-source` | `#6366f1` | `#818cf8` | Source (indigo) |
| `--color-cat-source-subtle` | `#eef2ff` | `#1e1b4b` | Source tile bg tint |
| `--color-cat-generator` | `#a855f7` | `#c084fc` | Generator (purple) |
| `--color-cat-generator-subtle` | `#faf5ff` | `#2e1065` | Generator tile bg tint |
| `--color-cat-transformer` | `#0ea5e9` | `#38bdf8` | Transformer (sky) |
| `--color-cat-transformer-subtle` | `#f0f9ff` | `#0c1a2e` | Transformer tile bg tint |
| `--color-cat-analyzer` | `#f59e0b` | `#fbbf24` | Analyzer (amber) |
| `--color-cat-analyzer-subtle` | `#fffbeb` | `#451a03` | Analyzer tile bg tint |
| `--color-cat-sink` | `#10b981` | `#34d399` | Sink (emerald) |
| `--color-cat-sink-subtle` | `#ecfdf5` | `#052e16` | Sink tile bg tint |

### Status Colors

Run and node execution status.

| Token | Light | Dark | Status |
|-------|-------|------|--------|
| `--color-status-pending` | `#a0a0ab` | `#5a5a66` | Pending (muted) |
| `--color-status-running` | `#6366f1` | `#818cf8` | Running (indigo) |
| `--color-status-completed` | `#10b981` | `#34d399` | Completed (emerald) |
| `--color-status-failed` | `#ef4444` | `#f87171` | Failed (red) |
| `--color-status-skipped` | `#78716c` | `#a8a29e` | Skipped (stone) |
| `--color-status-cancelled` | `#f59e0b` | `#fbbf24` | Cancelled (amber) |

### Connection State Colors

| Token | Light | Dark | State |
|-------|-------|------|-------|
| `--color-wire-connected` | (uses port type color) | (uses port type color) | Connected wire |
| `--color-wire-unconnected` | `#f59e0b` | `#fbbf24` | Unconnected port highlight |
| `--color-wire-mismatch` | `#ef4444` | `#f87171` | Type mismatch warning |
| `--color-wire-optional` | `#a0a0ab` | `#5a5a66` | Optional unconnected (no warning) |

---

## Typography

System font stack for performance. Monospace for schemas and code.

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `'Inter', system-ui, -apple-system, sans-serif` | All UI text |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', ui-monospace, monospace` | Schemas, code, port types |

### Type Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-xs` | `0.75rem / 1rem` | 400 | Port type badges, timestamps |
| `--text-sm` | `0.875rem / 1.25rem` | 400 | Config summary, secondary text |
| `--text-base` | `1rem / 1.5rem` | 400 | Body text, descriptions |
| `--text-md` | `1rem / 1.5rem` | 500 | Tile names, nav labels |
| `--text-lg` | `1.125rem / 1.75rem` | 600 | Page titles, toolbar pipeline name |
| `--text-xl` | `1.25rem / 1.75rem` | 600 | Section headers |
| `--text-2xl` | `1.5rem / 2rem` | 700 | Landing page title |

---

## Spacing Scale

Consistent 4px base grid.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | `0` | — |
| `--space-1` | `0.25rem` (4px) | Tight gaps (badge padding, icon margins) |
| `--space-2` | `0.5rem` (8px) | Port badge gaps, inner padding |
| `--space-3` | `0.75rem` (12px) | Tile inner padding, section gaps |
| `--space-4` | `1rem` (16px) | Standard padding, tile gaps |
| `--space-5` | `1.25rem` (20px) | Section spacing |
| `--space-6` | `1.5rem` (24px) | Tile outer margins, drawer padding |
| `--space-8` | `2rem` (32px) | Page padding, major sections |
| `--space-10` | `2.5rem` (40px) | Toolbar height |
| `--space-12` | `3rem` (48px) | Sidebar width (collapsed) |

---

## Sizing

| Token | Value | Usage |
|-------|-------|-------|
| `--tile-min-width` | `240px` | Minimum tile width |
| `--tile-max-width` | `360px` | Maximum tile width |
| `--tile-width` | `300px` | Default tile width |
| `--drawer-height` | `320px` | Detail drawer default height |
| `--sidebar-width-collapsed` | `48px` | Nav sidebar collapsed |
| `--sidebar-width-expanded` | `200px` | Nav sidebar expanded |
| `--toolbar-height` | `48px` | Top toolbar |
| `--minimap-width` | `180px` | Minimap panel |
| `--minimap-height` | `120px` | Minimap panel |
| `--port-badge-height` | `28px` | Port badge pill |
| `--status-dot-size` | `8px` | Status indicator dot |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Port badges, type pills |
| `--radius-md` | `8px` | Tiles, cards, buttons |
| `--radius-lg` | `12px` | Drawer, modals, command palette |
| `--radius-full` | `9999px` | Status dots, avatar, circular badges |

---

## Shadows

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle tile elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | `0 4px 6px rgba(0,0,0,0.4)` | Selected/hover tile, drawer |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | `0 10px 15px rgba(0,0,0,0.5)` | Command palette, floating panels |
| `--shadow-glow` | `0 0 12px rgba(99,102,241,0.3)` | `0 0 12px rgba(129,140,248,0.3)` | Running status glow |

---

## Wire Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--wire-width` | `2px` | Default wire stroke width |
| `--wire-width-hover` | `3px` | Wire on hover |
| `--wire-width-selected` | `3px` | Wire when either port is selected |
| `--wire-opacity` | `0.7` | Default wire opacity |
| `--wire-opacity-hover` | `1.0` | Wire on hover |
| `--wire-dash-mismatch` | `6 4` | Dash pattern for type mismatch wires |
| `--wire-curve-tension` | `0.5` | Bezier curve tension |

---

## Animation Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `100ms` | Hover states, small transitions |
| `--duration-normal` | `200ms` | Tile selection, drawer open/close |
| `--duration-slow` | `400ms` | Viewport pan, zoom transitions |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Most transitions |
| `--easing-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Tile insertion, status changes |
| `--pulse-duration` | `2s` | Pending status pulse animation |

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-canvas` | `0` | Viewport canvas |
| `--z-wires` | `10` | SVG wire layer |
| `--z-tiles` | `20` | DOM tiles |
| `--z-tile-selected` | `25` | Selected tile (above siblings) |
| `--z-handles` | `30` | Insertion handles, port drag targets |
| `--z-minimap` | `40` | Minimap overlay |
| `--z-toolbar` | `50` | Top toolbar |
| `--z-sidebar` | `50` | Navigation sidebar |
| `--z-drawer` | `60` | Detail drawer |
| `--z-palette` | `70` | Command palette overlay |
| `--z-tooltip` | `80` | Tooltips |
| `--z-toast` | `90` | Toast notifications |
