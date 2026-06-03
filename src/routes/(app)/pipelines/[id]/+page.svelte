<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Viewport, StepTile, DetailDrawer } from '$lib/components/pipeline';
	import { computeLayout } from '$lib/layout/tiling';

	let { data } = $props();

	const pipeline = $derived(data.pipeline);

	// Viewport state
	let zoom = $state(1.0);
	let pan = $state({ x: 40, y: 40 });

	// LOD derived from zoom
	type LOD = 'overview' | 'working' | 'detail';
	const lod: LOD = $derived(zoom < 0.5 ? 'overview' : zoom <= 1.0 ? 'working' : 'detail');

	// Mutable local nodes (so delete/update reflect immediately)
	// Must be declared before layout which references it
	let localNodes: typeof pipeline.nodes = $state([]);

	// Keep localNodes in sync with pipeline data
	$effect(() => {
		localNodes = pipeline.nodes;
	});

	// Layout computation
	const layout = $derived(
		computeLayout(
			localNodes.map((n: { id: string; adapterId: string }) => ({
				id: n.id,
				adapterId: n.adapterId
			})),
			pipeline.edges.map((e: { sourceNodeId: string; targetNodeId: string }) => ({
				sourceNodeId: e.sourceNodeId,
				targetNodeId: e.targetNodeId
			}))
		)
	);

	// Position lookup by nodeId
	const positionMap = $derived(
		new Map(layout.positions.map((p) => [p.nodeId, p]))
	);

	// Selected tile state
	let selectedNodeId = $state<string | null>(null);
	let drawerOpen = $state(false);

	// Derived selected node and its adapter
	const selectedNode = $derived(
		selectedNodeId ? localNodes.find((n: { id: string }) => n.id === selectedNodeId) ?? null : null
	);
	const selectedAdapter = $derived(selectedNode?.adapter ?? null);

	// Open drawer when a node is selected
	$effect(() => {
		drawerOpen = selectedNodeId !== null;
	});

	// Update node label/config via API then reflect locally
	async function handleNodeUpdate(
		nodeId: string,
		changes: { label?: string; config?: Record<string, unknown> }
	) {
		const pipelineId = page.params.id;
		await fetch(`/api/pipelines/${pipelineId}/nodes/${nodeId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(changes)
		});
		// Reflect changes in local state
		localNodes = localNodes.map((n: { id: string; label: string; config: Record<string, unknown> }) =>
			n.id === nodeId ? { ...n, ...changes } : n
		);
	}

	// Delete node via API then remove from local state
	async function handleNodeDelete(nodeId: string) {
		const pipelineId = page.params.id;
		await fetch(`/api/pipelines/${pipelineId}/nodes/${nodeId}`, { method: 'DELETE' });
		localNodes = localNodes.filter((n: { id: string }) => n.id !== nodeId);
		selectedNodeId = null;
		drawerOpen = false;
	}

	// Zoom controls
	function zoomIn() {
		zoom = Math.min(2.0, zoom * 1.2);
	}

	function zoomOut() {
		zoom = Math.max(0.25, zoom / 1.2);
	}

	function zoomReset() {
		zoom = 1.0;
		pan = { x: 40, y: 40 };
	}

	const zoomPercent = $derived(Math.round(zoom * 100));

	// Status badge style
	const STATUS_STYLES: Record<string, string> = {
		draft: 'background-color: var(--color-bg-secondary); color: var(--color-text-secondary)',
		active: 'background-color: oklch(0.25 0.08 145); color: oklch(0.75 0.18 145)',
		archived: 'background-color: var(--color-bg-secondary); color: var(--color-text-muted)'
	};

	// Run pipeline (placeholder — calls POST /api/pipelines/:id/runs)
	async function runPipeline() {
		const id = page.params.id;
		const res = await fetch(`/api/pipelines/${id}/runs`, { method: 'POST', body: JSON.stringify({ trigger: 'manual' }), headers: { 'Content-Type': 'application/json' } });
		if (res.ok) {
			const run = await res.json();
			goto(`/pipelines/${id}/runs/${run.id}`);
		}
	}
</script>

<div class="editor-shell">
	<!-- Toolbar -->
	<header class="toolbar">
		<div class="toolbar-left">
			<a href="/pipelines" class="back-link" aria-label="Back to pipelines">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</a>
			<h1 class="pipeline-name">{pipeline.name}</h1>
			<span class="status-badge" style={STATUS_STYLES[pipeline.status] ?? STATUS_STYLES.draft}>
				{pipeline.status}
			</span>
		</div>

		<div class="toolbar-right">
			<!-- Zoom controls -->
			<div class="zoom-controls" role="group" aria-label="Zoom controls">
				<button class="zoom-btn" onclick={zoomOut} aria-label="Zoom out" title="Zoom out">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
						<path d="M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
				<button class="zoom-level" onclick={zoomReset} title="Reset zoom" aria-label="Reset zoom to 100%">
					{zoomPercent}%
				</button>
				<button class="zoom-btn" onclick={zoomIn} aria-label="Zoom in" title="Zoom in">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
						<path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>

			<!-- Run button -->
			<button class="run-btn" onclick={runPipeline} aria-label="Run pipeline">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
					<path d="M4 2.5l8 5.5-8 5.5V2.5z" fill="currentColor"/>
				</svg>
				Run
			</button>
		</div>
	</header>

	<!-- Viewport fills remaining space -->
	<div
		class="viewport-container"
		role="presentation"
		onclick={(e) => {
			// Clear selection when clicking the viewport background (not a tile)
			if (e.target === e.currentTarget) {
				selectedNodeId = null;
			}
		}}
	>
		<Viewport bind:zoom bind:pan>
			{#if localNodes.length === 0}
				<div class="empty-canvas">
					<p class="empty-msg">No steps yet. Add an adapter to get started.</p>
				</div>
			{:else}
				{#each localNodes as node (node.id)}
					{@const pos = positionMap.get(node.id)}
					{#if pos}
						<div
							class="tile-wrapper"
							style:position="absolute"
							style:left="{pos.x}px"
							style:top="{pos.y}px"
							style:width="{pos.width}px"
						>
							<StepTile
								{node}
								adapter={node.adapter}
								{lod}
								selected={selectedNodeId === node.id}
								onclick={() => {
									selectedNodeId = selectedNodeId === node.id ? null : node.id;
								}}
							/>
						</div>
					{/if}
				{/each}
			{/if}
		</Viewport>
	</div>

	<!-- Detail Drawer -->
	<DetailDrawer
		bind:open={drawerOpen}
		node={selectedNode}
		adapter={selectedAdapter}
		onupdate={handleNodeUpdate}
		ondelete={handleNodeDelete}
	/>
</div>

<style>
	.editor-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		padding: 0 var(--spacing-3);
		background-color: var(--color-bg-secondary);
		border-bottom: 1px solid var(--color-border-primary);
		flex-shrink: 0;
		gap: var(--spacing-3);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-shrink: 0;
	}

	.back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		text-decoration: none;
		flex-shrink: 0;
		transition: background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.back-link:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.back-link:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	.pipeline-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 300px;
	}

	.status-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	/* Zoom controls */
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 1px;
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		transition: background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.zoom-btn:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.zoom-level {
		min-width: 44px;
		height: 28px;
		border: none;
		border-left: 1px solid var(--color-border-primary);
		border-right: 1px solid var(--color-border-primary);
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		padding: 0 4px;
		transition: background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.zoom-level:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	/* Run button */
	.run-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		height: 30px;
		padding: 0 var(--spacing-3);
		border: none;
		border-radius: var(--radius-md);
		background-color: oklch(0.45 0.18 145);
		color: oklch(0.97 0.02 145);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--easing-default);
	}

	.run-btn:hover {
		background-color: oklch(0.52 0.18 145);
	}

	.run-btn:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Viewport container fills remaining height */
	.viewport-container {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	/* Empty canvas message */
	.empty-canvas {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.empty-msg {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		background-color: color-mix(in srgb, var(--color-bg-surface) 80%, transparent);
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
	}

	/* Tile wrapper — absolutely positioned inside viewport */
	.tile-wrapper {
		pointer-events: auto;
	}
</style>
