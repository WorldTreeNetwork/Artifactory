<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	type AdapterCategory = 'source' | 'generator' | 'transformer' | 'analyzer' | 'sink';

	interface PortSummary {
		name: string;
		mimeTypes: string[];
	}

	interface AdapterEntry {
		id: string;
		name: string;
		description: string;
		category: string;
		inputPorts: PortSummary[];
		outputPorts: PortSummary[];
	}

	interface Props {
		open: boolean;
		adapters: AdapterEntry[];
		onselect?: (adapterId: string) => void;
	}

	let { open = $bindable(), adapters, onselect }: Props = $props();

	const CATEGORY_ORDER: AdapterCategory[] = ['source', 'generator', 'transformer', 'analyzer', 'sink'];

	let query = $state('');
	let activeIndex = $state(0);
	let searchInput = $state<HTMLInputElement | null>(null);

	// Filter adapters by query (name, description, category)
	const filtered = $derived((): AdapterEntry[] => {
		const q = query.trim().toLowerCase();
		if (!q) return adapters;
		return adapters.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				a.description.toLowerCase().includes(q) ||
				a.category.toLowerCase().includes(q)
		);
	});

	// Group filtered adapters by category in display order
	const grouped = $derived((): Array<{ category: AdapterCategory; items: AdapterEntry[] }> => {
		const map = new Map<AdapterCategory, AdapterEntry[]>();
		for (const cat of CATEGORY_ORDER) {
			map.set(cat, []);
		}
		for (const adapter of filtered()) {
			const cat = adapter.category as AdapterCategory;
			const bucket = map.get(cat) ?? map.get('source')!;
			bucket.push(adapter);
		}
		return CATEGORY_ORDER.map((cat) => ({ category: cat, items: map.get(cat)! })).filter(
			(g) => g.items.length > 0
		);
	});

	// Flat list of items for keyboard navigation
	const flatItems = $derived((): AdapterEntry[] => {
		return grouped().flatMap((g) => g.items);
	});

	// Reset state when palette opens
	$effect(() => {
		if (open) {
			query = '';
			activeIndex = 0;
			// Focus input after DOM update
			setTimeout(() => searchInput?.focus(), 0);
		}
	});

	// Clamp activeIndex when filtered list changes
	$effect(() => {
		const total = flatItems().length;
		if (activeIndex >= total && total > 0) {
			activeIndex = total - 1;
		}
	});

	function close() {
		open = false;
	}

	function selectItem(adapterId: string) {
		onselect?.(adapterId);
		close();
	}

	function handleBackdropClick() {
		close();
	}

	function handleKeydown(event: KeyboardEvent) {
		const items = flatItems();
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, items.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const item = items[activeIndex];
			if (item) selectItem(item.id);
		}
	}

	function handleQueryInput() {
		activeIndex = 0;
	}

	// Get global flat index for an item (for highlight check)
	function itemFlatIndex(category: AdapterCategory, itemIndex: number): number {
		let offset = 0;
		for (const group of grouped()) {
			if (group.category === category) return offset + itemIndex;
			offset += group.items.length;
		}
		return -1;
	}

	// Category label (capitalize first letter)
	function categoryLabel(cat: AdapterCategory): string {
		return cat.charAt(0).toUpperCase() + cat.slice(1) + 's';
	}

	// Port summary string: "2 in → 1 out"
	function portSummary(adapter: AdapterEntry): string {
		const inCount = adapter.inputPorts.length;
		const outCount = adapter.outputPorts.length;
		if (inCount === 0 && outCount === 0) return '';
		if (inCount === 0) return `${outCount} out`;
		if (outCount === 0) return `${inCount} in`;
		return `${inCount} in \u2192 ${outCount} out`;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="backdrop"
		role="presentation"
		transition:fade={{ duration: 150 }}
		onclick={handleBackdropClick}
	></div>

	<!-- Panel -->
	<div
		class="palette"
		role="dialog"
		aria-label="Command palette"
		aria-modal="true"
		tabindex="-1"
		transition:fly={{ y: -12, duration: 200 }}
		onkeydown={handleKeydown}
	>
		<!-- Search input row -->
		<div class="search-row">
			<span class="search-icon" aria-hidden="true">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5" />
					<path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
			</span>
			<input
				bind:this={searchInput}
				bind:value={query}
				oninput={handleQueryInput}
				type="text"
				class="search-input"
				placeholder="Search adapters..."
				aria-label="Search adapters"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if query}
				<button class="clear-btn" onclick={() => { query = ''; activeIndex = 0; searchInput?.focus(); }} aria-label="Clear search">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
				</button>
			{/if}
		</div>

		<!-- Results list -->
		<div class="results" role="listbox" aria-label="Adapter results">
			{#if grouped().length === 0}
				<div class="empty-state">No adapters match "{query}"</div>
			{:else}
				{#each grouped() as group}
					<!-- Category header -->
					<div
						class="category-header"
						style="color: var(--color-cat-{group.category})"
					>
						{categoryLabel(group.category)}
					</div>

					<!-- Adapter items in this category -->
					{#each group.items as item, i}
						{@const flatIdx = itemFlatIndex(group.category, i)}
						{@const isActive = flatIdx === activeIndex}
						<button
							class="adapter-item"
							class:adapter-item--active={isActive}
							role="option"
							aria-selected={isActive}
							onclick={() => selectItem(item.id)}
						>
							<div class="item-main">
								<!-- Category color dot -->
								<span
									class="cat-dot"
									style="background-color: var(--color-cat-{item.category})"
									aria-hidden="true"
								></span>
								<!-- Adapter name -->
								<span class="item-name">{item.name}</span>
								<!-- Port summary (shown at end of name line) -->
								{#if portSummary(item)}
									<span class="port-summary">{portSummary(item)}</span>
								{/if}
							</div>
							<!-- Description -->
							{#if item.description}
								<div class="item-desc">{item.description}</div>
							{/if}
						</button>
					{/each}
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.35);
		z-index: var(--z-palette);
	}

	.palette {
		position: fixed;
		top: 20%;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 480px;
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		z-index: calc(var(--z-palette) + 1);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--font-family-sans, sans-serif);
		max-height: 60vh;
	}

	/* Search row */
	.search-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border-primary);
		flex-shrink: 0;
	}

	.search-icon {
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		font-size: 0.9375rem;
		color: var(--color-text-primary);
		font-family: inherit;
		line-height: 1.5;
	}

	.search-input::placeholder {
		color: var(--color-text-muted);
	}

	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 2px;
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast) var(--easing-default);
	}

	.clear-btn:hover {
		color: var(--color-text-secondary);
	}

	/* Results */
	.results {
		overflow-y: auto;
		padding: var(--spacing-2) 0;
		flex: 1;
	}

	.empty-state {
		padding: var(--spacing-6) var(--spacing-4);
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	/* Category header */
	.category-header {
		padding: var(--spacing-2) var(--spacing-4) var(--spacing-1);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	/* Adapter item */
	.adapter-item {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: var(--spacing-2) var(--spacing-4);
		transition: background-color var(--duration-fast) var(--easing-default);
		border-radius: 0;
	}

	.adapter-item:hover,
	.adapter-item--active {
		background-color: var(--color-bg-surface-hover);
	}

	.item-main {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	/* 6px category color dot */
	.cat-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.item-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary);
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.port-summary {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.item-desc {
		margin-top: 1px;
		padding-left: calc(6px + var(--spacing-2)); /* align under name, after dot */
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
