<script lang="ts">
	import { fly } from 'svelte/transition';

	type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

	interface NodeRun {
		nodeId: string;
		status: string;
	}

	interface Run {
		id: string;
		status: RunStatus;
		startedAt: string | null;
		completedAt: string | null;
		nodeRuns?: NodeRun[];
	}

	interface Props {
		run: Run | null;
		totalNodes: number;
		oncancel?: () => void;
	}

	let { run, totalNodes, oncancel }: Props = $props();

	// Count completed node runs
	const completedCount = $derived(
		run?.nodeRuns?.filter((nr) => nr.status === 'completed').length ?? 0
	);

	// Progress dots — max 10 shown to avoid overflow
	const maxDots = $derived(Math.min(totalNodes, 10));
	const dots = $derived(
		Array.from({ length: maxDots }, (_, i) => i < completedCount)
	);

	// Elapsed time display
	function formatElapsed(startedAt: string | null, completedAt: string | null): string {
		if (!startedAt) return '0s';
		const start = new Date(startedAt).getTime();
		const end = completedAt ? new Date(completedAt).getTime() : Date.now();
		const secs = Math.max(0, Math.floor((end - start) / 1000));
		return `${secs}s`;
	}

	// Status color style
	const statusStyle = $derived((): string => {
		switch (run?.status) {
			case 'running':
				return 'color: var(--color-status-running)';
			case 'completed':
				return 'color: var(--color-status-completed)';
			case 'failed':
				return 'color: var(--color-status-failed)';
			case 'cancelled':
				return 'color: var(--color-status-cancelled)';
			case 'pending':
				return 'color: var(--color-status-pending)';
			default:
				return 'color: var(--color-text-muted)';
		}
	});

	// Whether cancel button is shown
	const canCancel = $derived(run?.status === 'running' || run?.status === 'pending');

	// Short run ID
	const shortId = $derived(run ? run.id.slice(0, 6) : '');
</script>

{#if run}
	<div class="status-bar" transition:fly={{ y: 36, duration: 200 }}>
		<span class="run-label">Run #{shortId}</span>

		<span class="separator">—</span>

		<!-- Progress dots -->
		<span class="dots" aria-label="{completedCount} of {totalNodes} nodes completed">
			{#each dots as filled}
				<span
					class="dot"
					class:dot--filled={filled}
					class:dot--empty={!filled}
				></span>
			{/each}
		</span>

		<span class="progress-text">{completedCount}/{totalNodes}</span>

		<span class="separator">—</span>

		<span class="elapsed" aria-label="Elapsed time">
			{formatElapsed(run.startedAt, run.completedAt)}
		</span>

		<span class="separator">—</span>

		<span class="status-text" style={statusStyle()}>
			{run.status}
		</span>

		{#if canCancel}
			<button
				class="cancel-btn"
				onclick={oncancel}
				aria-label="Cancel run"
				title="Cancel run"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
					<path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</button>
		{/if}
	</div>
{/if}

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		height: 36px;
		padding: 0 var(--spacing-4);
		background-color: var(--color-bg-secondary);
		border-top: 1px solid var(--color-border-primary);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		user-select: none;
	}

	.run-label {
		color: var(--color-text-primary);
		font-weight: 500;
		font-family: var(--font-family-mono, monospace);
		flex-shrink: 0;
	}

	.separator {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.dots {
		display: flex;
		align-items: center;
		gap: 3px;
		flex-shrink: 0;
	}

	.dot {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.dot--filled {
		background-color: var(--color-status-completed);
	}

	.dot--empty {
		background-color: var(--color-border-primary);
	}

	.progress-text {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.elapsed {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.status-text {
		flex-shrink: 0;
		font-weight: 500;
		text-transform: lowercase;
	}

	.cancel-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		margin-left: auto;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.cancel-btn:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-status-failed);
		border-color: var(--color-status-failed);
	}

	.cancel-btn:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}
</style>
