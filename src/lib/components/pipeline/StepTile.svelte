<script lang="ts">
	import PortBadge from './PortBadge.svelte';

	type LOD = 'overview' | 'working' | 'detail';
	type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
	type AdapterCategory = 'source' | 'generator' | 'transformer' | 'analyzer' | 'sink';

	interface PortDef {
		name: string;
		description: string;
		mimeTypes: string[];
		required: boolean;
	}

	interface NodeProp {
		id: string;
		adapterId: string;
		label: string;
		config: Record<string, unknown>;
	}

	interface AdapterProp {
		name: string;
		category: AdapterCategory;
		inputPorts: PortDef[];
		outputPorts: PortDef[];
	}

	interface Props {
		node: NodeProp;
		adapter: AdapterProp | null;
		lod: LOD;
		selected?: boolean;
		status?: NodeStatus;
		durationMs?: number;
		error?: string;
		onclick?: () => void;
	}

	let {
		node,
		adapter,
		lod,
		selected = false,
		status = 'idle',
		durationMs,
		error,
		onclick
	}: Props = $props();

	// Category icon letters (single uppercase initial)
	const CATEGORY_ICONS: Record<AdapterCategory, string> = {
		source: 'S',
		generator: 'G',
		transformer: 'T',
		analyzer: 'A',
		sink: 'K'
	};

	// Format duration in ms to a human-readable string
	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	// Config summary: first key-value pair, truncated
	const configSummary = $derived((): string => {
		if (!node.config) return '';
		const entries = Object.entries(node.config);
		if (entries.length === 0) return '';
		const [key, val] = entries[0];
		const valStr = typeof val === 'string' ? val : JSON.stringify(val);
		const line = `${key}: ${valStr}`;
		return line.length > 40 ? line.slice(0, 37) + '…' : line;
	});

	// All config entries for detail LOD
	const configEntries = $derived((): Array<[string, string]> => {
		return Object.entries(node.config ?? {}).map(([k, v]) => {
			const valStr = typeof v === 'string' ? v : JSON.stringify(v);
			return [k, valStr] as [string, string];
		});
	});

	// Derived border/shadow style for the tile
	const tileStyle = $derived((): string => {
		const cat = adapter?.category ?? 'source';
		const parts: string[] = [];

		// Width is always fixed
		parts.push(`width: var(--tile-width)`);

		// Background tint from category
		parts.push(`background-color: var(--color-cat-${cat}-subtle)`);

		// Left border: category color (or status override)
		if (status === 'failed') {
			parts.push(`border-left-color: var(--color-status-failed)`);
		} else if (status === 'running') {
			parts.push(`border-left-color: var(--color-status-running)`);
			parts.push(`box-shadow: var(--shadow-glow)`);
		} else if (selected) {
			parts.push(`border-left-color: var(--color-border-focus)`);
			parts.push(`box-shadow: var(--shadow-md)`);
		} else {
			parts.push(`border-left-color: var(--color-cat-${cat})`);
			parts.push(`box-shadow: var(--shadow-sm)`);
		}

		// Z-index
		if (selected) {
			parts.push(`z-index: var(--z-tile-selected)`);
		} else {
			parts.push(`z-index: var(--z-tiles)`);
		}

		return parts.join('; ');
	});

	// Status dot inline style
	const statusDotStyle = $derived((): string => {
		const s = status === 'idle' ? 'pending' : status;
		return `background-color: var(--color-status-${s}); width: var(--status-dot-size); height: var(--status-dot-size)`;
	});

	// Category icon colors — use the category color for the letter badge
	const categoryIconStyle = $derived((): string => {
		const cat = adapter?.category ?? 'source';
		return `color: var(--color-cat-${cat}); border-color: var(--color-cat-${cat})`;
	});

	// Failed border override (full border, not just left)
	const failedBorderStyle = $derived((): string => {
		if (status === 'failed') return 'border-color: var(--color-status-failed)';
		return '';
	});

	function handleClick() {
		onclick?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onclick?.();
		}
	}
</script>

<div
	class="step-tile"
	role="button"
	tabindex="0"
	aria-pressed={selected}
	aria-label={node.label || adapter?.name || node.adapterId}
	style={tileStyle()}
	style:border-left-width="3px"
	style:border-left-style="solid"
	style:border-width={status === 'failed' ? '1px' : undefined}
	style:border-style={status === 'failed' ? 'solid' : undefined}
	style:border-color={status === 'failed' ? 'var(--color-status-failed)' : undefined}
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<!-- Header row: name + category icon + status dot -->
	<div class="tile-header">
		<!-- Category icon/letter badge -->
		<span class="category-badge" style={categoryIconStyle()} title={adapter?.category}>
			{CATEGORY_ICONS[adapter?.category ?? 'source']}
		</span>

		<!-- Tile name -->
		<span class="tile-name" title={node.label || adapter?.name}>
			{node.label || adapter?.name || node.adapterId}
		</span>

		<!-- Duration badge (completed state) -->
		{#if status === 'completed' && durationMs !== undefined}
			<span class="duration-badge">
				{formatDuration(durationMs)}
			</span>
		{/if}

		<!-- Status dot -->
		<span
			class="status-dot"
			class:status-dot--running={status === 'running'}
			class:status-dot--pending={status === 'pending'}
			style={statusDotStyle()}
			title={status}
		></span>
	</div>

	<!-- Working + Detail LOD: ports and config -->
	{#if lod === 'working' || lod === 'detail'}
		{#if adapter}
			<!-- Input ports -->
			{#if adapter.inputPorts.length > 0}
				<div class="port-section port-section--input">
					{#each adapter.inputPorts as port}
						<PortBadge nodeId={node.id} {port} type="input" {lod} />
					{/each}
				</div>
			{/if}

			<!-- Config summary -->
			{#if lod === 'working' && configSummary()}
				<div class="config-summary">
					{configSummary()}
				</div>
			{/if}

			{#if lod === 'detail' && configEntries().length > 0}
				<div class="config-detail">
					{#each configEntries() as [key, val]}
						<div class="config-row">
							<span class="config-key">{key}</span>
							<span class="config-val">{val}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Output ports -->
			{#if adapter.outputPorts.length > 0}
				<div class="port-section port-section--output">
					{#each adapter.outputPorts as port}
						<PortBadge nodeId={node.id} {port} type="output" {lod} />
					{/each}
				</div>
			{/if}
		{:else}
			<!-- No adapter found -->
			<div class="no-adapter-msg">
				Adapter <code>{node.adapterId}</code> not found
			</div>
		{/if}
	{/if}

	<!-- Error message (failed state) -->
	{#if status === 'failed' && error}
		<div class="error-row" title={error}>
			{#if lod === 'detail'}
				{error}
			{:else}
				{error.length > 60 ? error.slice(0, 57) + '…' : error}
			{/if}
		</div>
	{/if}
</div>

<style>
	.step-tile {
		position: relative;
		box-sizing: border-box;
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		padding: var(--spacing-3);
		cursor: pointer;
		transition:
			box-shadow var(--duration-normal) var(--easing-default),
			border-color var(--duration-normal) var(--easing-default),
			background-color var(--duration-fast) var(--easing-default);
		font-family: var(--font-family-sans, sans-serif);
		outline: none;
	}

	.step-tile:hover {
		background-color: var(--color-bg-surface-hover);
	}

	.step-tile:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Header */
	.tile-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-height: 24px;
	}

	.category-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-sm);
		border: 1px solid currentColor;
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1;
		flex-shrink: 0;
		opacity: 0.85;
	}

	.tile-name {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.duration-badge {
		font-size: 0.7rem;
		color: var(--color-status-completed);
		background-color: var(--color-port-model-subtle);
		border-radius: var(--radius-sm);
		padding: 1px 5px;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.status-dot {
		display: block;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	/* Running pulse animation */
	.status-dot--running {
		animation: pulse-run 1.2s ease-in-out infinite;
	}

	/* Pending shimmer */
	.status-dot--pending {
		animation: shimmer-pending 2s ease-in-out infinite;
	}

	@keyframes pulse-run {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(1.3); }
	}

	@keyframes shimmer-pending {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 1; }
	}

	/* Port sections */
	.port-section {
		margin-top: var(--spacing-2);
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.port-section--output {
		margin-top: var(--spacing-1);
		border-top: 1px solid var(--color-border-subtle);
		padding-top: var(--spacing-2);
	}

	.port-section--input {
		border-top: 1px solid var(--color-border-subtle);
		padding-top: var(--spacing-2);
	}

	/* Config */
	.config-summary {
		margin-top: var(--spacing-2);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-family: var(--font-family-mono, monospace);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 2px var(--spacing-1);
		background-color: color-mix(in srgb, var(--color-bg-surface) 60%, transparent);
		border-radius: var(--radius-sm);
	}

	.config-detail {
		margin-top: var(--spacing-2);
		display: flex;
		flex-direction: column;
		gap: 2px;
		background-color: color-mix(in srgb, var(--color-bg-surface) 60%, transparent);
		border-radius: var(--radius-sm);
		padding: var(--spacing-1) var(--spacing-2);
	}

	.config-row {
		display: flex;
		gap: var(--spacing-2);
		font-size: 0.75rem;
		font-family: var(--font-family-mono, monospace);
	}

	.config-key {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.config-val {
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Error */
	.error-row {
		margin-top: var(--spacing-2);
		font-size: 0.75rem;
		color: var(--color-status-failed);
		border-top: 1px solid color-mix(in srgb, var(--color-status-failed) 30%, transparent);
		padding-top: var(--spacing-1);
		word-break: break-word;
	}

	/* No adapter */
	.no-adapter-msg {
		margin-top: var(--spacing-2);
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.no-adapter-msg code {
		font-family: var(--font-family-mono, monospace);
	}
</style>
