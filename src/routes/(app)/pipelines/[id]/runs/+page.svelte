<script lang="ts">
	let { data } = $props();

	type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	type TriggerType = 'manual' | 'schedule' | 'webhook';

	type Run = {
		id: string;
		pipelineId: string;
		status: RunStatus;
		trigger: TriggerType;
		startedAt: string | null;
		completedAt: string | null;
		createdAt: string | null;
	};

	type Pipeline = {
		id: string;
		name: string;
	};

	const pipeline: Pipeline | null = $derived(data.pipeline ?? null);
	// cancelledIds tracks optimistic cancel state; actual run list comes from data
	let cancelledIds: Map<string, string> = $state(new Map());
	const runs: Run[] = $derived(
		(data.runs ?? []).map((r: Run) =>
			cancelledIds.has(r.id)
				? { ...r, status: 'cancelled' as RunStatus, completedAt: cancelledIds.get(r.id)! }
				: r
		)
	);

	type FilterValue = 'all' | RunStatus;
	let activeFilter: FilterValue = $state('all');
	let cancelling: Set<string> = $state(new Set());

	const filters: Array<{ value: FilterValue; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'running', label: 'Running' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'failed', label: 'Failed' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	const filtered = $derived(
		activeFilter === 'all' ? runs : runs.filter((r) => r.status === activeFilter)
	);

	function formatDuration(startedAt: string | null, completedAt: string | null): string {
		if (!startedAt) return '—';
		const start = new Date(startedAt).getTime();
		const end = completedAt ? new Date(completedAt).getTime() : Date.now();
		const ms = end - start;
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		const m = Math.floor(ms / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		return `${m}m ${s}s`;
	}

	function formatDateTime(dateStr: string | null): string {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function shortId(id: string): string {
		return id.slice(0, 8);
	}

	function canCancel(status: RunStatus): boolean {
		return status === 'pending' || status === 'running';
	}

	async function cancelRun(runId: string) {
		if (cancelling.has(runId)) return;
		cancelling = new Set([...cancelling, runId]);
		try {
			const res = await fetch(`/api/runs/${runId}/cancel`, { method: 'POST' });
			if (res.ok) {
				const next = new Map(cancelledIds);
				next.set(runId, new Date().toISOString());
				cancelledIds = next;
			}
		} finally {
			cancelling = new Set([...cancelling].filter((id) => id !== runId));
		}
	}
</script>

<div class="page">
	<!-- Header -->
	<div class="page-header">
		<div class="breadcrumb">
			<a href="/pipelines" class="breadcrumb-link">Pipelines</a>
			<span class="breadcrumb-sep" aria-hidden="true">/</span>
			{#if pipeline}
				<a href="/pipelines/{pipeline.id}" class="breadcrumb-link">{pipeline.name}</a>
			{:else}
				<span class="breadcrumb-current">Pipeline</span>
			{/if}
			<span class="breadcrumb-sep" aria-hidden="true">/</span>
			<span class="breadcrumb-current">Runs</span>
		</div>
		{#if pipeline}
			<a href="/pipelines/{pipeline.id}" class="btn-secondary">Back to Editor</a>
		{/if}
	</div>

	<!-- Filter bar -->
	<div class="filter-bar" role="group" aria-label="Filter by status">
		{#each filters as f}
			<button
				class="filter-pill"
				class:active={activeFilter === f.value}
				onclick={() => (activeFilter = f.value)}
				aria-pressed={activeFilter === f.value}
			>
				{f.label}
			</button>
		{/each}
	</div>

	<!-- Table / empty state -->
	{#if filtered.length === 0}
		<div class="empty-state">
			<svg class="empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
				<polyline
					points="4,28 12,18 20,32 28,12 36,24 44,16"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<p class="empty-title">
				{activeFilter === 'all' ? 'No runs yet' : `No ${activeFilter} runs`}
			</p>
			<p class="empty-sub">
				{activeFilter === 'all'
					? 'Run the pipeline from the editor.'
					: 'Try a different filter.'}
			</p>
		</div>
	{:else}
		<div class="table-wrapper">
			<table class="runs-table">
				<thead>
					<tr>
						<th scope="col">Run #</th>
						<th scope="col">Status</th>
						<th scope="col">Trigger</th>
						<th scope="col">Started</th>
						<th scope="col">Duration</th>
						<th scope="col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as run (run.id)}
						<tr class="run-row">
							<td>
								<span class="run-id">{shortId(run.id)}</span>
							</td>
							<td>
								<span class="status-badge status-{run.status}">
									<span class="status-dot" aria-hidden="true"></span>
									{run.status}
								</span>
							</td>
							<td>
								<span class="trigger-text">{run.trigger}</span>
							</td>
							<td>
								<span class="date-text">{formatDateTime(run.startedAt ?? run.createdAt)}</span>
							</td>
							<td>
								<span class="duration-text">{formatDuration(run.startedAt, run.completedAt)}</span>
							</td>
							<td>
								<div class="actions">
									<a
										href="/pipelines/{run.pipelineId}/runs/{run.id}"
										class="btn-action"
									>
										View
									</a>
									{#if canCancel(run.status)}
										<button
											class="btn-cancel"
											onclick={() => cancelRun(run.id)}
											disabled={cancelling.has(run.id)}
										>
											{cancelling.has(run.id) ? 'Cancelling…' : 'Cancel'}
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: var(--spacing-8);
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	/* Header */
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: 0.875rem;
		flex-wrap: wrap;
	}

	.breadcrumb-link {
		color: var(--color-text-secondary);
		text-decoration: none;
		transition: color var(--duration-fast) var(--easing-default);
	}

	.breadcrumb-link:hover {
		color: var(--color-text-primary);
	}

	.breadcrumb-link:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.breadcrumb-sep {
		color: var(--color-text-muted);
		user-select: none;
	}

	.breadcrumb-current {
		color: var(--color-text-primary);
		font-weight: 500;
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		background-color: transparent;
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default),
			border-color var(--duration-fast) var(--easing-default);
		white-space: nowrap;
	}

	.btn-secondary:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
		border-color: var(--color-border-primary);
	}

	.btn-secondary:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Filter bar */
	.filter-bar {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.filter-pill {
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		border: 1px solid var(--color-border-primary);
		background-color: transparent;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default),
			border-color var(--duration-fast) var(--easing-default);
	}

	.filter-pill:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.filter-pill.active {
		background-color: var(--color-bg-surface-selected);
		color: var(--color-text-primary);
		border-color: var(--color-border-primary);
		font-weight: 500;
	}

	.filter-pill:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Table */
	.table-wrapper {
		overflow-x: auto;
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
	}

	.runs-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.runs-table thead {
		background-color: var(--color-bg-secondary);
		border-bottom: 1px solid var(--color-border-primary);
	}

	.runs-table th {
		padding: var(--spacing-3) var(--spacing-4);
		text-align: left;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.runs-table td {
		padding: var(--spacing-3) var(--spacing-4);
		color: var(--color-text-primary);
		border-bottom: 1px solid var(--color-border-subtle);
		vertical-align: middle;
	}

	.run-row:last-child td {
		border-bottom: none;
	}

	.run-row:hover td {
		background-color: var(--color-bg-surface-hover);
	}

	.run-row {
		transition: background-color var(--duration-fast) var(--easing-default);
	}

	/* Run ID */
	.run-id {
		font-family: var(--font-family-mono);
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		letter-spacing: 0.02em;
	}

	/* Status badge */
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: 2px var(--spacing-2);
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		white-space: nowrap;
	}

	.status-dot {
		width: var(--status-dot-size);
		height: var(--status-dot-size);
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.status-pending {
		background-color: color-mix(in srgb, var(--color-status-pending) 15%, transparent);
		color: var(--color-status-pending);
	}
	.status-pending .status-dot {
		background-color: var(--color-status-pending);
	}

	.status-running {
		background-color: color-mix(in srgb, var(--color-status-running) 15%, transparent);
		color: var(--color-status-running);
	}
	.status-running .status-dot {
		background-color: var(--color-status-running);
		animation: pulse var(--pulse-duration) ease-in-out infinite;
	}

	.status-completed {
		background-color: color-mix(in srgb, var(--color-status-completed) 15%, transparent);
		color: var(--color-status-completed);
	}
	.status-completed .status-dot {
		background-color: var(--color-status-completed);
	}

	.status-failed {
		background-color: color-mix(in srgb, var(--color-status-failed) 15%, transparent);
		color: var(--color-status-failed);
	}
	.status-failed .status-dot {
		background-color: var(--color-status-failed);
	}

	.status-cancelled {
		background-color: color-mix(in srgb, var(--color-status-cancelled) 15%, transparent);
		color: var(--color-status-cancelled);
	}
	.status-cancelled .status-dot {
		background-color: var(--color-status-cancelled);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* Trigger / date / duration */
	.trigger-text {
		color: var(--color-text-secondary);
		text-transform: capitalize;
	}

	.date-text {
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.duration-text {
		font-family: var(--font-family-mono);
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	/* Actions */
	.actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		justify-content: flex-end;
	}

	.btn-action {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-1) var(--spacing-3);
		background-color: transparent;
		color: var(--color-border-focus);
		border: 1px solid var(--color-border-focus);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
		white-space: nowrap;
	}

	.btn-action:hover {
		background-color: color-mix(in srgb, var(--color-border-focus) 10%, transparent);
	}

	.btn-action:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	.btn-cancel {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-1) var(--spacing-3);
		background-color: transparent;
		color: var(--color-status-failed);
		border: 1px solid var(--color-status-failed);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing-default),
			opacity var(--duration-fast) var(--easing-default);
		white-space: nowrap;
	}

	.btn-cancel:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--color-status-failed) 10%, transparent);
	}

	.btn-cancel:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel:focus-visible {
		outline: 2px solid var(--color-status-failed);
		outline-offset: 2px;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-4);
		padding: var(--spacing-8);
		text-align: center;
		color: var(--color-text-muted);
		min-height: 320px;
	}

	.empty-icon {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	.empty-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.empty-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
		max-width: 360px;
	}

	/* Accessibility */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
