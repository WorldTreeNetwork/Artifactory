<script lang="ts">
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import { Viewport, StepTile, WireLayer, Minimap, getPortTypeColor } from '$lib/components/pipeline';
	import { computeLayout } from '$lib/layout/tiling';

	let { data } = $props();

	const pipeline = $derived(data.pipeline);

	// ── Run state (live-updated via polling) ──────────────────────────────────

	interface LogEntry {
		level: 'debug' | 'info' | 'warn' | 'error';
		message: string;
		timestamp: string;
		data?: unknown;
	}

	interface OutputAsset {
		id: string;
		mimeType: string;
		size: number;
	}

	interface NodeRunInfo {
		id: string;
		nodeId: string;
		status: string;
		durationMs?: number | null;
		error?: string | null;
		logs?: LogEntry[];
		outputAssets?: OutputAsset[];
	}

	interface RunData {
		id: string;
		status: string;
		startedAt: string | null;
		completedAt: string | null;
		createdAt: string | null;
		nodeRuns: NodeRunInfo[];
	}

	let run = $state<RunData | null>(null);

	// Keep run in sync with server data on initial load / navigations
	$effect(() => {
		run = data.run as RunData | null;
	});

	// ── Polling ───────────────────────────────────────────────────────────────

	const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

	let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

	async function pollRun() {
		try {
			const res = await fetch(`/api/runs/${page.params.runId}`);
			if (!res.ok) return;
			run = await res.json();
			if (run && TERMINAL_STATUSES.has(run.status)) {
				stopPolling();
			}
		} catch {
			// Network error — keep polling
		}
	}

	function stopPolling() {
		if (pollInterval !== null) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	// Start polling if run is active
	$effect(() => {
		if (run && !TERMINAL_STATUSES.has(run.status)) {
			stopPolling();
			pollInterval = setInterval(pollRun, 2000);
		}
		return () => stopPolling();
	});

	// ── Cancel ────────────────────────────────────────────────────────────────

	let cancelling = $state(false);

	async function cancelRun() {
		if (!run) return;
		cancelling = true;
		try {
			await fetch(`/api/runs/${run.id}/cancel`, { method: 'POST' });
			await pollRun();
		} finally {
			cancelling = false;
		}
	}

	// ── Viewport state ────────────────────────────────────────────────────────

	let zoom = $state(1.0);
	let pan = $state({ x: 40, y: 40 });

	type LOD = 'overview' | 'working' | 'detail';
	const lod: LOD = $derived(zoom < 0.5 ? 'overview' : zoom <= 1.0 ? 'working' : 'detail');

	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	const nodes = $derived(pipeline?.nodes ?? []);
	const edges = $derived(pipeline?.edges ?? []);

	const layout = $derived(
		computeLayout(
			nodes.map((n: { id: string; adapterId: string }) => ({ id: n.id, adapterId: n.adapterId })),
			edges.map((e: { sourceNodeId: string; targetNodeId: string }) => ({
				sourceNodeId: e.sourceNodeId,
				targetNodeId: e.targetNodeId
			}))
		)
	);

	const positionMap = $derived(new Map(layout.positions.map((p) => [p.nodeId, p])));

	const categoryMap = $derived(
		Object.fromEntries(
			nodes
				.filter((n: { id: string; adapter: { category: string } | null }) => n.adapter?.category)
				.map((n: { id: string; adapter: { category: string } }) => [n.id, n.adapter.category])
		)
	);

	// Port colors for WireLayer
	const portColors = $derived(
		Object.fromEntries(
			nodes.flatMap((n: { id: string; adapter: { outputPorts: Array<{ name: string; mimeTypes: string[] }> } | null }) =>
				(n.adapter?.outputPorts ?? []).map((p: { name: string; mimeTypes: string[] }) => [
					`${n.id}-output-${p.name}`,
					`var(--color-port-${getPortTypeColor(p.mimeTypes)})`
				])
			)
		)
	);

	// ── Node run lookups ──────────────────────────────────────────────────────

	const nodeRunMap = $derived(
		new Map<string, NodeRunInfo>(
			(run?.nodeRuns ?? []).map((nr: NodeRunInfo) => [nr.nodeId, nr])
		)
	);

	const nodeStatusMap = $derived(
		Object.fromEntries([...nodeRunMap].map(([nodeId, nr]) => [nodeId, nr.status]))
	);

	const nodeDurationMap = $derived(
		Object.fromEntries(
			[...nodeRunMap]
				.filter(([, nr]) => nr.durationMs != null)
				.map(([nodeId, nr]) => [nodeId, nr.durationMs!])
		)
	);

	const nodeErrorMap = $derived(
		Object.fromEntries(
			[...nodeRunMap]
				.filter(([, nr]) => nr.error)
				.map(([nodeId, nr]) => [nodeId, nr.error!])
		)
	);

	// ── Selected node + log drawer ────────────────────────────────────────────

	let selectedNodeId = $state<string | null>(null);
	let drawerOpen = $state(false);
	let activeTab = $state<'logs' | 'assets' | 'error'>('logs');

	$effect(() => {
		drawerOpen = selectedNodeId !== null;
	});

	// Reset to logs tab when a different node is selected
	$effect(() => {
		if (selectedNodeId) {
			activeTab = 'logs';
		}
	});

	const selectedNode = $derived(
		selectedNodeId ? nodes.find((n: { id: string }) => n.id === selectedNodeId) ?? null : null
	);

	const selectedNodeRun = $derived(
		selectedNodeId ? nodeRunMap.get(selectedNodeId) ?? null : null
	);

	// Whether to show the Error tab
	const showErrorTab = $derived(selectedNodeRun?.status === 'failed' && !!selectedNodeRun?.error);

	// Close drawer on Escape
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && drawerOpen) {
			drawerOpen = false;
			selectedNodeId = null;
		}
	}

	// ── Zoom controls ─────────────────────────────────────────────────────────

	function zoomIn() { zoom = Math.min(2.0, zoom * 1.2); }
	function zoomOut() { zoom = Math.max(0.25, zoom / 1.2); }
	function zoomReset() { zoom = 1.0; pan = { x: 40, y: 40 }; }

	const zoomPercent = $derived(Math.round(zoom * 100));

	// ── Duration / time helpers ───────────────────────────────────────────────

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function formatElapsed(startedAt: string | null, completedAt: string | null): string {
		if (!startedAt) return '—';
		const start = new Date(startedAt).getTime();
		const end = completedAt ? new Date(completedAt).getTime() : Date.now();
		return formatDuration(end - start);
	}

	function formatTimestamp(ts: string): string {
		try {
			return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
		} catch {
			return ts;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	}

	// ── Status badge styles ───────────────────────────────────────────────────

	const RUN_STATUS_STYLES: Record<string, string> = {
		pending: 'background-color: var(--color-bg-surface); color: var(--color-status-pending); border: 1px solid var(--color-status-pending)',
		running: 'background-color: oklch(0.2 0.06 260); color: var(--color-status-running); border: 1px solid var(--color-status-running)',
		completed: 'background-color: oklch(0.18 0.05 145); color: var(--color-status-completed); border: 1px solid var(--color-status-completed)',
		failed: 'background-color: oklch(0.18 0.06 20); color: var(--color-status-failed); border: 1px solid var(--color-status-failed)',
		cancelled: 'background-color: var(--color-bg-surface); color: var(--color-status-cancelled); border: 1px solid var(--color-status-cancelled)'
	};

	const LOG_LEVEL_STYLES: Record<string, string> = {
		debug: 'background-color: var(--color-bg-surface); color: var(--color-text-muted)',
		info: 'background-color: var(--color-port-text-subtle); color: var(--color-port-text)',
		warn: 'background-color: var(--color-port-audio-subtle); color: var(--color-port-audio)',
		error: 'background-color: var(--color-port-video-subtle); color: var(--color-port-video)'
	};

	function runStatusStyle(s: string): string {
		return RUN_STATUS_STYLES[s] ?? RUN_STATUS_STYLES.pending;
	}

	function logLevelStyle(level: string): string {
		return LOG_LEVEL_STYLES[level] ?? LOG_LEVEL_STYLES.info;
	}

	// Breadcrumb run label
	const runLabel = $derived(
		run ? `Run #${run.id.slice(0, 8)}` : `Run #${(page.params.runId ?? '').slice(0, 8)}`
	);

	const runIsActive = $derived(run ? !TERMINAL_STATUSES.has(run.status) : false);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="run-shell">
	<!-- Toolbar -->
	<header class="toolbar">
		<div class="toolbar-left">
			<!-- Back to runs list -->
			<a
				href="/pipelines/{page.params.id}/runs"
				class="back-link"
				aria-label="Back to runs"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</a>

			<!-- Breadcrumb -->
			<nav class="breadcrumb" aria-label="Breadcrumb">
				<a href="/pipelines" class="bc-link">Pipelines</a>
				<span class="bc-sep" aria-hidden="true">/</span>
				<a href="/pipelines/{page.params.id}" class="bc-link">{pipeline?.name ?? '…'}</a>
				<span class="bc-sep" aria-hidden="true">/</span>
				<a href="/pipelines/{page.params.id}/runs" class="bc-link">Runs</a>
				<span class="bc-sep" aria-hidden="true">/</span>
				<span class="bc-current">{runLabel}</span>
			</nav>

			<!-- Run status badge -->
			{#if run}
				<span class="status-badge" style={runStatusStyle(run.status)}>
					{run.status}
				</span>
			{/if}

			<!-- Duration -->
			{#if run}
				<span class="duration-display">
					{formatElapsed(run.startedAt, run.completedAt)}
				</span>
			{/if}
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

			<!-- Cancel button (only if run is active) -->
			{#if runIsActive}
				<button
					class="cancel-btn"
					onclick={cancelRun}
					disabled={cancelling}
					aria-label="Cancel run"
				>
					<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
						<path d="M2 2l9 9M11 2L2 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					{cancelling ? 'Cancelling…' : 'Cancel'}
				</button>
			{/if}
		</div>
	</header>

	<!-- Viewport (read-only canvas with status overlay) -->
	<div
		class="viewport-container"
		bind:clientWidth={viewportWidth}
		bind:clientHeight={viewportHeight}
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				selectedNodeId = null;
			}
		}}
	>
		<Viewport bind:zoom bind:pan>
			{#if nodes.length === 0}
				<div class="empty-canvas">
					<p class="empty-msg">No steps in this pipeline.</p>
				</div>
			{:else}
				{#each nodes as node (node.id)}
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
								status={(nodeStatusMap[node.id] ?? 'idle') as 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped'}
								durationMs={nodeDurationMap[node.id]}
								error={nodeErrorMap[node.id]}
								onclick={() => {
									selectedNodeId = selectedNodeId === node.id ? null : node.id;
								}}
							/>
						</div>
					{/if}
				{/each}
			{/if}

			<WireLayer
				edges={edges}
				positions={layout.positions}
				zoom={zoom}
				{portColors}
			/>
		</Viewport>

		<!-- Minimap -->
		<Minimap
			positions={layout.positions}
			edges={edges.map((e: { sourceNodeId: string; targetNodeId: string }) => ({
				sourceNodeId: e.sourceNodeId,
				targetNodeId: e.targetNodeId
			}))}
			totalWidth={layout.totalWidth}
			totalHeight={layout.totalHeight}
			{viewportWidth}
			{viewportHeight}
			{zoom}
			{pan}
			{categoryMap}
			onnavigate={(newPan) => { pan = newPan; }}
		/>
	</div>

	<!-- Log Drawer -->
	{#if drawerOpen && selectedNode}
		<div
			class="log-drawer"
			role="complementary"
			aria-label="Node run details"
			transition:slide={{ duration: 200, axis: 'y' }}
		>
			<!-- Drag handle -->
			<div class="drag-handle" aria-hidden="true">
				<span class="drag-handle-bar"></span>
			</div>

			<!-- Drawer header -->
			<div class="drawer-header">
				<div class="drawer-title-row">
					<span class="drawer-node-name">
						{selectedNode.label || selectedNode.adapter?.name || selectedNode.adapterId}
					</span>
					{#if selectedNodeRun}
						<span class="status-badge status-badge--sm" style={runStatusStyle(selectedNodeRun.status)}>
							{selectedNodeRun.status}
						</span>
						{#if selectedNodeRun.durationMs != null}
							<span class="drawer-duration">{formatDuration(selectedNodeRun.durationMs)}</span>
						{/if}
					{/if}
				</div>

				<div class="drawer-controls">
					<!-- Tabs -->
					<div class="tab-bar" role="tablist">
						<button
							class="tab-btn"
							class:tab-btn--active={activeTab === 'logs'}
							role="tab"
							aria-selected={activeTab === 'logs'}
							onclick={() => (activeTab = 'logs')}
						>
							Logs
							{#if (selectedNodeRun?.logs ?? []).length > 0}
								<span class="tab-count">{(selectedNodeRun?.logs ?? []).length}</span>
							{/if}
						</button>
						<button
							class="tab-btn"
							class:tab-btn--active={activeTab === 'assets'}
							role="tab"
							aria-selected={activeTab === 'assets'}
							onclick={() => (activeTab = 'assets')}
						>
							Assets
							{#if (selectedNodeRun?.outputAssets ?? []).length > 0}
								<span class="tab-count">{(selectedNodeRun?.outputAssets ?? []).length}</span>
							{/if}
						</button>
						{#if showErrorTab}
							<button
								class="tab-btn tab-btn--error"
								class:tab-btn--active={activeTab === 'error'}
								role="tab"
								aria-selected={activeTab === 'error'}
								onclick={() => (activeTab = 'error')}
							>
								Error
							</button>
						{/if}
					</div>

					<!-- Close -->
					<button
						class="close-btn"
						onclick={() => { drawerOpen = false; selectedNodeId = null; }}
						aria-label="Close drawer"
						title="Close"
					>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
							<path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="drawer-body">
				{#if activeTab === 'logs'}
					<div class="logs-panel">
						{#if (selectedNodeRun?.logs ?? []).length === 0}
							<p class="empty-state">No log entries for this node.</p>
						{:else}
							<div class="log-list" role="log" aria-live="polite" aria-label="Node logs">
								{#each (selectedNodeRun?.logs ?? []) as entry, i (i)}
									<div class="log-entry">
										<span class="log-ts">{formatTimestamp(entry.timestamp)}</span>
										<span class="log-level-badge" style={logLevelStyle(entry.level)}>{entry.level}</span>
										<span class="log-msg">{entry.message}</span>
										{#if entry.data !== undefined && entry.data !== null}
											<span class="log-data">{typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'assets'}
					<div class="assets-panel">
						{#if (selectedNodeRun?.outputAssets ?? []).length === 0}
							<p class="empty-state">No output assets produced by this node.</p>
						{:else}
							<div class="asset-list">
								{#each (selectedNodeRun?.outputAssets ?? []) as asset (asset.id)}
									<div class="asset-row">
										<span class="asset-id">{asset.id.slice(0, 12)}…</span>
										<span class="mime-pill">{asset.mimeType}</span>
										<span class="asset-size">{formatBytes(asset.size)}</span>
										<a
											href="/assets/{asset.id}"
											class="asset-link"
											title="View asset"
										>
											<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
												<path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M7 1h4m0 0v4M11 1L5 7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
										</a>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'error'}
					<div class="error-panel">
						{#if selectedNodeRun?.error}
							<pre class="error-block">{selectedNodeRun.error}</pre>
						{:else}
							<p class="empty-state">No error details available.</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.run-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* ── Toolbar ─────────────────────────────────────────────────────────────── */

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

	/* Back link */
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
		transition:
			background-color var(--duration-fast) var(--easing-default),
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

	/* Breadcrumb */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: 0.8125rem;
		min-width: 0;
	}

	.bc-link {
		color: var(--color-text-secondary);
		text-decoration: none;
		white-space: nowrap;
		transition: color var(--duration-fast) var(--easing-default);
	}

	.bc-link:hover {
		color: var(--color-text-primary);
	}

	.bc-sep {
		color: var(--color-text-muted);
		user-select: none;
	}

	.bc-current {
		color: var(--color-text-primary);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}

	/* Status badge */
	.status-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.status-badge--sm {
		font-size: 0.65rem;
		padding: 1px 6px;
	}

	/* Duration display */
	.duration-display {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	/* Cancel button */
	.cancel-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		height: 30px;
		padding: 0 var(--spacing-3);
		border: 1px solid color-mix(in srgb, var(--color-status-failed) 50%, transparent);
		border-radius: var(--radius-md);
		background: none;
		color: var(--color-status-failed);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			border-color var(--duration-fast) var(--easing-default);
	}

	.cancel-btn:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--color-status-failed) 10%, transparent);
		border-color: var(--color-status-failed);
	}

	.cancel-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.cancel-btn:focus-visible {
		outline: 2px solid var(--color-status-failed);
		outline-offset: 2px;
	}

	/* ── Zoom controls ───────────────────────────────────────────────────────── */

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
		transition:
			background-color var(--duration-fast) var(--easing-default),
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
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.zoom-level:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	/* ── Viewport ────────────────────────────────────────────────────────────── */

	.viewport-container {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

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

	.tile-wrapper {
		pointer-events: auto;
	}

	/* ── Log Drawer ──────────────────────────────────────────────────────────── */

	.log-drawer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--drawer-height);
		background-color: var(--color-bg-secondary);
		border-top: 1px solid var(--color-border-primary);
		z-index: var(--z-drawer);
		box-shadow: var(--shadow-md);
		display: flex;
		flex-direction: column;
		font-family: var(--font-family-sans, sans-serif);
	}

	/* Drag handle */
	.drag-handle {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 16px;
		flex-shrink: 0;
	}

	.drag-handle-bar {
		display: block;
		width: 36px;
		height: 3px;
		border-radius: var(--radius-full);
		background-color: var(--color-border-primary);
	}

	/* Drawer header */
	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--spacing-4);
		padding-bottom: var(--spacing-2);
		gap: var(--spacing-3);
		flex-shrink: 0;
	}

	.drawer-title-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
		flex: 1;
	}

	.drawer-node-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.drawer-duration {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.drawer-controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-shrink: 0;
	}

	/* Tabs */
	.tab-bar {
		display: flex;
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.tab-btn {
		height: 26px;
		padding: 0 var(--spacing-3);
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.tab-btn--active {
		background-color: var(--color-bg-surface-selected);
		color: var(--color-text-primary);
	}

	.tab-btn:hover:not(.tab-btn--active) {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.tab-btn--error {
		color: var(--color-status-failed);
	}

	.tab-btn--error.tab-btn--active {
		background-color: color-mix(in srgb, var(--color-status-failed) 15%, var(--color-bg-surface-selected));
	}

	.tab-count {
		font-size: 0.65rem;
		background-color: var(--color-bg-surface);
		border-radius: var(--radius-full);
		padding: 0 4px;
		color: var(--color-text-muted);
		min-width: 16px;
		text-align: center;
	}

	/* Close */
	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.close-btn:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Drawer body */
	.drawer-body {
		flex: 1;
		overflow: hidden;
		padding: 0 var(--spacing-4);
	}

	/* ── Logs panel ──────────────────────────────────────────────────────────── */

	.logs-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.log-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-bottom: var(--spacing-3);
	}

	.log-entry {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-2);
		padding: 3px 0;
		border-bottom: 1px solid var(--color-border-subtle);
		font-size: 0.75rem;
		font-family: var(--font-family-mono, monospace);
		line-height: 1.4;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-ts {
		color: var(--color-text-muted);
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.log-level-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 1px 4px;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.log-msg {
		color: var(--color-text-primary);
		flex: 1;
		word-break: break-word;
	}

	.log-data {
		color: var(--color-text-secondary);
		flex-shrink: 0;
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Assets panel ────────────────────────────────────────────────────────── */

	.assets-panel {
		height: 100%;
		overflow-y: auto;
		padding-bottom: var(--spacing-3);
	}

	.asset-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.asset-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0;
		border-bottom: 1px solid var(--color-border-subtle);
		font-size: 0.8125rem;
	}

	.asset-row:last-child {
		border-bottom: none;
	}

	.asset-id {
		font-family: var(--font-family-mono, monospace);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.mime-pill {
		font-size: 0.7rem;
		font-family: var(--font-family-mono, monospace);
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		padding: 1px 5px;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.asset-size {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.asset-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		text-decoration: none;
		margin-left: auto;
		flex-shrink: 0;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.asset-link:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	/* ── Error panel ─────────────────────────────────────────────────────────── */

	.error-panel {
		height: 100%;
		overflow-y: auto;
		padding-bottom: var(--spacing-3);
	}

	.error-block {
		margin: 0;
		padding: var(--spacing-3) var(--spacing-4);
		background-color: color-mix(in srgb, var(--color-status-failed) 8%, var(--color-bg-surface));
		border: 1px solid color-mix(in srgb, var(--color-status-failed) 30%, transparent);
		border-radius: var(--radius-md);
		color: var(--color-status-failed);
		font-family: var(--font-family-mono, monospace);
		font-size: 0.8125rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* ── Shared empty state ──────────────────────────────────────────────────── */

	.empty-state {
		margin: var(--spacing-4) 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}
</style>
