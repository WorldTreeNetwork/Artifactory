<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	type Pipeline = {
		id: string;
		name: string;
		description: string | null;
		status: 'draft' | 'active' | 'archived';
		createdAt: Date;
		updatedAt: Date;
	};

	let pipelines: Pipeline[] = $derived(data.pipelines ?? []);
	type FilterValue = 'all' | 'draft' | 'active' | 'archived';
	let activeFilter: FilterValue = $state('all');
	let creating = $state(false);

	const filters: Array<{ value: FilterValue; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'active', label: 'Active' },
		{ value: 'archived', label: 'Archived' }
	];

	const filtered = $derived(
		activeFilter === 'all' ? pipelines : pipelines.filter((p) => p.status === activeFilter)
	);

	async function createPipeline() {
		if (creating) return;
		creating = true;
		try {
			const res = await fetch('/api/pipelines', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Untitled Pipeline' })
			});
			if (res.ok) {
				const pipeline = await res.json();
				goto(`/pipelines/${pipeline.id}`);
			}
		} finally {
			creating = false;
		}
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '—';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div class="page">
	<!-- Header -->
	<div class="page-header">
		<h1 class="page-title">Pipelines</h1>
		<button class="btn-primary" onclick={createPipeline} disabled={creating}>
			{creating ? 'Creating…' : 'New Pipeline'}
		</button>
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

	<!-- Card grid / empty state -->
	{#if filtered.length === 0}
		<div class="empty-state">
			<svg
				class="empty-icon"
				width="48"
				height="48"
				viewBox="0 0 48 48"
				fill="none"
				aria-hidden="true"
			>
				<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2" />
				<rect x="28" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2" />
				<rect x="4" y="28" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2" />
				<rect x="28" y="28" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2" />
				<path
					d="M20 12h8M20 36h8M12 20v8M36 20v8"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
			<p class="empty-title">
				{activeFilter === 'all' ? 'No pipelines yet' : `No ${activeFilter} pipelines`}
			</p>
			<p class="empty-sub">
				{activeFilter === 'all'
					? 'Build your first pipeline to get started.'
					: 'Try a different filter or create a new pipeline.'}
			</p>
			{#if activeFilter === 'all'}
				<button class="btn-primary" onclick={createPipeline} disabled={creating}>
					{creating ? 'Creating…' : 'Create your first pipeline'}
				</button>
			{/if}
		</div>
	{:else}
		<div class="card-grid">
			{#each filtered as pipeline (pipeline.id)}
				<a class="pipeline-card" href="/pipelines/{pipeline.id}" aria-label={pipeline.name}>
					<div class="card-header">
						<span class="pipeline-name">{pipeline.name}</span>
						<span class="status-badge status-{pipeline.status}">{pipeline.status}</span>
					</div>
					{#if pipeline.description}
						<p class="pipeline-desc">{pipeline.description}</p>
					{/if}
					<div class="card-footer">
						<span class="updated-date">Updated {formatDate(pipeline.updatedAt)}</span>
					</div>
				</a>
			{/each}
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

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-4);
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
		margin: 0;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		background-color: var(--color-border-focus);
		color: var(--color-text-inverse);
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			opacity var(--duration-fast) var(--easing-default),
			background-color var(--duration-fast) var(--easing-default);
		text-decoration: none;
		white-space: nowrap;
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.88;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary:focus-visible {
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

	/* Card grid */
	.card-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: var(--spacing-4);
	}

	@media (min-width: 768px) {
		.card-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.card-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Pipeline card */
	.pipeline-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		text-decoration: none;
		box-shadow: var(--shadow-sm);
		transition:
			background-color var(--duration-fast) var(--easing-default),
			box-shadow var(--duration-fast) var(--easing-default),
			border-color var(--duration-fast) var(--easing-default);
		cursor: pointer;
	}

	.pipeline-card:hover {
		background-color: var(--color-bg-surface-hover);
		box-shadow: var(--shadow-md);
		border-color: var(--color-border-focus);
	}

	.pipeline-card:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.pipeline-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-primary);
		line-height: 1.4;
		word-break: break-word;
	}

	/* Status badges */
	.status-badge {
		flex-shrink: 0;
		display: inline-block;
		padding: 2px var(--spacing-2);
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		line-height: 1.5;
	}

	.status-draft {
		background-color: var(--color-bg-surface-selected);
		color: var(--color-text-secondary);
	}

	.status-active {
		background-color: var(--color-cat-sink-subtle);
		color: var(--color-cat-sink);
	}

	.status-archived {
		background-color: var(--color-port-any-subtle);
		color: var(--color-port-any);
	}

	.pipeline-desc {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		line-height: 1.5;
	}

	.card-footer {
		margin-top: auto;
	}

	.updated-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
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
</style>

