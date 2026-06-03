<script lang="ts">
	import { getPortTypeColor } from '$lib/components/pipeline';

	interface Port {
		name: string;
		description: string;
		mimeTypes: string[];
		required: boolean;
	}

	interface Adapter {
		id: string;
		name: string;
		description: string;
		category: string;
		inputPorts: Port[];
		outputPorts: Port[];
	}

	let { data } = $props();

	const CATEGORY_ORDER = ['source', 'generator', 'transformer', 'analyzer', 'sink'] as const;
	const CATEGORY_LABELS: Record<string, string> = {
		source: 'Sources',
		generator: 'Generators',
		transformer: 'Transformers',
		analyzer: 'Analyzers',
		sink: 'Sinks'
	};

	let search = $state('');

	const filteredAdapters = $derived(
		(data.adapters as Adapter[]).filter((a) => {
			if (!search.trim()) return true;
			const q = search.toLowerCase();
			return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
		})
	);

	const groupedAdapters = $derived(
		CATEGORY_ORDER.reduce(
			(acc, cat) => {
				const adapters = filteredAdapters.filter((a) => a.category === cat);
				if (adapters.length > 0) acc[cat] = adapters;
				return acc;
			},
			{} as Record<string, Adapter[]>
		)
	);
</script>

<div class="page">
	<header class="page-header">
		<div class="header-text">
			<h1 class="title">Adapters</h1>
			<p class="subtitle">Available pipeline adapters</p>
		</div>
		<div class="search-wrap">
			<input
				class="search-input"
				type="search"
				placeholder="Search adapters..."
				bind:value={search}
				aria-label="Search adapters"
			/>
		</div>
	</header>

	{#if (data.adapters as Adapter[]).length === 0}
		<div class="empty-state">No adapters registered.</div>
	{:else if filteredAdapters.length === 0}
		<div class="empty-state">No adapters match "{search}".</div>
	{:else}
		<div class="catalog">
			{#each CATEGORY_ORDER as cat}
				{#if groupedAdapters[cat]}
					<section class="category-section" aria-label={CATEGORY_LABELS[cat]}>
						<div class="category-header">
							<span
								class="category-dot"
								style="background-color: var(--color-cat-{cat})"
								aria-hidden="true"
							></span>
							<h2 class="category-name">{CATEGORY_LABELS[cat]}</h2>
						</div>

						<div class="adapter-grid">
							{#each groupedAdapters[cat] as adapter}
								<div
									class="adapter-card"
									style="border-left-color: var(--color-cat-{adapter.category}); background-color: var(--color-cat-{adapter.category}-subtle)"
								>
									<div class="adapter-header">
										<span class="adapter-name">{adapter.name}</span>
									</div>
									{#if adapter.description}
										<p class="adapter-description">{adapter.description}</p>
									{/if}

									<div class="ports-section">
										{#if adapter.inputPorts.length === 0}
											<p class="no-inputs">No inputs (source node)</p>
										{:else}
											<div class="port-group">
												<span class="port-label">Inputs</span>
												<div class="port-list">
													{#each adapter.inputPorts as port}
														{@const portType = getPortTypeColor(port.mimeTypes)}
														<div class="port-row">
															<span class="port-name">{port.name}</span>
															<div class="mime-pills">
																{#each port.mimeTypes as mime}
																	<span
																		class="mime-pill"
																		style="background-color: var(--color-port-{getPortTypeColor([mime])}-subtle); color: var(--color-port-{getPortTypeColor([mime])})"
																	>{mime}</span>
																{/each}
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										{#if adapter.outputPorts.length > 0}
											<div class="port-group">
												<span class="port-label">Outputs</span>
												<div class="port-list">
													{#each adapter.outputPorts as port}
														<div class="port-row">
															<span class="port-name">{port.name}</span>
															<div class="mime-pills">
																{#each port.mimeTypes as mime}
																	<span
																		class="mime-pill"
																		style="background-color: var(--color-port-{getPortTypeColor([mime])}-subtle); color: var(--color-port-{getPortTypeColor([mime])})"
																	>{mime}</span>
																{/each}
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: var(--spacing-8);
		max-width: 960px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-8);
		flex-wrap: wrap;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
		margin: 0;
		line-height: 2rem;
	}

	.subtitle {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.search-wrap {
		flex-shrink: 0;
	}

	.search-input {
		width: 240px;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-primary);
		background-color: var(--color-bg-surface);
		color: var(--color-text-primary);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		transition: border-color var(--duration-fast) var(--easing-default);
	}

	.search-input:focus {
		border-color: var(--color-border-focus);
	}

	.search-input::placeholder {
		color: var(--color-text-muted);
	}

	.empty-state {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		padding: var(--spacing-8) 0;
		text-align: center;
	}

	.catalog {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-8);
	}

	.category-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.category-dot {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.category-name {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.adapter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-4);
	}

	.adapter-card {
		border-left: 3px solid transparent;
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		background-color: var(--color-bg-surface);
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.adapter-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.adapter-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.adapter-description {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin: 0;
		line-height: 1.5;
	}

	.ports-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		border-top: 1px solid var(--color-border-subtle);
		padding-top: var(--spacing-3);
		margin-top: auto;
	}

	.port-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.port-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.port-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.port-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.port-name {
		font-size: 0.75rem;
		font-family: var(--font-family-mono, monospace);
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.mime-pills {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.mime-pill {
		font-size: 0.65rem;
		border-radius: var(--radius-sm);
		padding: 1px 5px;
		font-family: var(--font-family-mono, monospace);
		white-space: nowrap;
	}

	.no-inputs {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
		font-style: italic;
	}
</style>
