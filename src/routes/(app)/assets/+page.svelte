<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Asset = {
		id: string;
		mimeType: string;
		storageKey: string | null;
		size: number;
		content: string | null;
		createdAt: number | null;
		metadata: unknown;
	};

	// Local reactive asset list seeded from server data.
	// untrack() prevents Svelte's state_referenced_locally warning.
	let assets = $state<Asset[]>(untrack(() => data.assets ?? []));

	// Upload state
	let uploading = $state(false);
	let dragOver = $state(false);

	// Filter state
	type Category = 'all' | 'image' | 'text' | 'model' | 'video' | 'audio' | 'json' | 'other';
	let activeCategory = $state<Category>('all');

	const categories: { id: Category; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'image', label: 'Images' },
		{ id: 'text', label: 'Text' },
		{ id: 'model', label: '3D Models' },
		{ id: 'video', label: 'Video' },
		{ id: 'audio', label: 'Audio' },
		{ id: 'json', label: 'JSON' },
		{ id: 'other', label: 'Other' }
	];

	function getMimeCategory(mimeType: string): Category {
		if (!mimeType) return 'other';
		if (mimeType === 'application/json') return 'json';
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('text/')) return 'text';
		if (mimeType.startsWith('model/')) return 'model';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		return 'other';
	}

	let filteredAssets = $derived(
		activeCategory === 'all'
			? assets
			: assets.filter((a) => getMimeCategory(a.mimeType) === activeCategory)
	);

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(ts: number | null): string {
		if (!ts) return '';
		return new Date(ts * 1000).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getFilename(asset: Asset): string {
		if (asset.storageKey) {
			const parts = asset.storageKey.split('/');
			return parts[parts.length - 1] || 'Unnamed';
		}
		return 'Unnamed';
	}

	// Category style tokens
	type MimeStyle = { color: string; bg: string };
	function getMimeStyle(mimeType: string): MimeStyle {
		const cat = getMimeCategory(mimeType);
		switch (cat) {
			case 'image':
				return { color: 'var(--color-port-image)', bg: 'var(--color-port-image-subtle)' };
			case 'text':
				return { color: 'var(--color-port-text)', bg: 'var(--color-port-text-subtle)' };
			case 'model':
				return { color: 'var(--color-port-model)', bg: 'var(--color-port-model-subtle)' };
			case 'video':
				return { color: 'var(--color-port-video)', bg: 'var(--color-port-video-subtle)' };
			case 'audio':
				return { color: 'var(--color-port-audio)', bg: 'var(--color-port-audio-subtle)' };
			case 'json':
				return { color: 'var(--color-port-structured)', bg: 'var(--color-port-structured-subtle)' };
			default:
				return { color: 'var(--color-port-any)', bg: 'var(--color-port-any-subtle)' };
		}
	}

	async function uploadFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		uploading = true;
		try {
			for (const file of Array.from(files)) {
				const form = new FormData();
				form.append('file', file);
				const res = await fetch('/api/assets', { method: 'POST', body: form });
				if (res.ok) {
					const asset = await res.json();
					assets = [asset, ...assets];
				}
			}
		} finally {
			uploading = false;
		}
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		uploadFiles(e.dataTransfer?.files ?? null);
	}

	function onFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		uploadFiles(input.files);
		input.value = '';
	}

	async function deleteAsset(id: string) {
		const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
		if (res.ok) {
			assets = assets.filter((a) => a.id !== id);
		}
	}
</script>

<div class="page">
	<!-- Page header -->
	<div class="page-header">
		<h1 class="page-title">Assets</h1>
		<label class="upload-btn" class:uploading>
			{#if uploading}
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="spin">
					<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="20 10" />
				</svg>
				Uploading…
			{:else}
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
				Upload
			{/if}
			<input
				type="file"
				multiple
				class="sr-only"
				disabled={uploading}
				onchange={onFileInput}
				aria-label="Upload files"
			/>
		</label>
	</div>

	<!-- Drop zone -->
	<div
		class="drop-zone"
		class:drag-over={dragOver}
		role="region"
		aria-label="File drop zone"
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="drop-icon">
			<path d="M12 3v12M9 6l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			<path d="M3 15v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
		</svg>
		<span class="drop-label">Drop files here to upload</span>
	</div>

	<!-- Filter bar -->
	<div class="filter-bar" role="group" aria-label="Filter by type">
		{#each categories as cat}
			<button
				class="filter-pill"
				class:active={activeCategory === cat.id}
				onclick={() => (activeCategory = cat.id)}
				aria-pressed={activeCategory === cat.id}
			>
				{cat.label}
			</button>
		{/each}
	</div>

	<!-- Grid or empty state -->
	{#if filteredAssets.length === 0}
		<div class="empty-state">
			<svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" class="empty-icon">
				<rect x="8" y="10" width="32" height="36" rx="3" stroke="currentColor" stroke-width="1.5" />
				<path d="M16 20h16M16 27h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				<path d="M30 6v8h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M30 6l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
			<p class="empty-text">
				{activeCategory === 'all'
					? 'No assets yet. Upload your first file.'
					: 'No assets in this category.'}
			</p>
		</div>
	{:else}
		<div class="asset-grid">
			{#each filteredAssets as asset (asset.id)}
				{@const style = getMimeStyle(asset.mimeType)}
				{@const cat = getMimeCategory(asset.mimeType)}
				<div class="asset-card">
					<!-- Thumbnail area -->
					<div class="asset-thumb">
						{#if cat === 'image' && asset.storageKey}
							<img
								src="/api/storage/{asset.storageKey}"
								alt={getFilename(asset)}
								class="thumb-img"
								loading="lazy"
							/>
						{:else if cat === 'text' && asset.content}
							<pre class="thumb-text">{asset.content.slice(0, 100)}</pre>
						{:else if cat === 'image'}
							<!-- Image icon when no storageKey -->
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" stroke-width="1.5" />
								<circle cx="11" cy="13" r="2.5" stroke="currentColor" stroke-width="1.5" />
								<path d="M4 22l6-5 5 4 4-3 9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						{:else if cat === 'model'}
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<path d="M16 4L28 10v12L16 28 4 22V10L16 4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
								<path d="M4 10l12 6M16 16l12-6M16 16v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						{:else if cat === 'video'}
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<rect x="3" y="7" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.5" />
								<path d="M23 13l6-4v14l-6-4V13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
							</svg>
						{:else if cat === 'audio'}
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<path d="M12 26V6l16-4v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								<circle cx="8" cy="26" r="4" stroke="currentColor" stroke-width="1.5" />
								<circle cx="24" cy="18" r="4" stroke="currentColor" stroke-width="1.5" />
							</svg>
						{:else if cat === 'json'}
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<path d="M8 10c-2 0-3 1-3 3v2c0 2-1 3-2 3 1 0 2 1 2 3v2c0 2 1 3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
								<path d="M24 10c2 0 3 1 3 3v2c0 2 1 3 2 3-1 0-2 1-2 3v2c0 2-1 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
								<circle cx="16" cy="16" r="1.5" fill="currentColor" />
								<circle cx="12" cy="16" r="1.5" fill="currentColor" />
								<circle cx="20" cy="16" r="1.5" fill="currentColor" />
							</svg>
						{:else if cat === 'text'}
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" stroke-width="1.5" />
								<path d="M10 11h12M10 16h12M10 21h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						{:else}
							<!-- Generic file icon -->
							<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:{style.color}">
								<path d="M8 4h12l8 8v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
								<path d="M20 4v8h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						{/if}
					</div>

					<!-- Card body -->
					<div class="asset-body">
						<p class="asset-name" title={getFilename(asset)}>{getFilename(asset)}</p>

						<span
							class="mime-badge"
							style="color:{style.color}; background:{style.bg}"
						>
							{asset.mimeType}
						</span>

						<div class="asset-meta">
							<span>{formatSize(asset.size)}</span>
							{#if asset.createdAt}
								<span>{formatDate(asset.createdAt)}</span>
							{/if}
						</div>
					</div>

					<!-- Delete button -->
					<button
						class="delete-btn"
						onclick={() => deleteAsset(asset.id)}
						title="Delete asset"
						aria-label="Delete {getFilename(asset)}"
					>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
							<path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
					</button>
				</div>
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

	/* Header */
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 2rem;
		color: var(--color-text-primary);
		margin: 0;
	}

	.upload-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		background-color: var(--color-border-focus);
		color: #ffffff;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity var(--duration-fast) var(--easing-default);
		user-select: none;
	}

	.upload-btn:hover {
		opacity: 0.85;
	}

	.upload-btn.uploading {
		opacity: 0.6;
		cursor: default;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Drop zone */
	.drop-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-3);
		padding: var(--spacing-6);
		border: 2px dashed var(--color-border-primary);
		border-radius: var(--radius-lg);
		background-color: var(--color-bg-secondary);
		color: var(--color-text-muted);
		transition:
			border-color var(--duration-fast) var(--easing-default),
			background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.drop-zone.drag-over {
		border-color: var(--color-border-focus);
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	.drop-icon {
		flex-shrink: 0;
	}

	.drop-label {
		font-size: 0.875rem;
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
		background-color: var(--color-bg-surface);
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
		background-color: var(--color-border-focus);
		border-color: var(--color-border-focus);
		color: #ffffff;
	}

	/* Asset grid */
	.asset-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (min-width: 768px) {
		.asset-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.asset-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	/* Asset card */
	.asset-card {
		position: relative;
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		transition:
			box-shadow var(--duration-fast) var(--easing-default),
			background-color var(--duration-fast) var(--easing-default);
		display: flex;
		flex-direction: column;
	}

	.asset-card:hover {
		box-shadow: var(--shadow-md);
		background-color: var(--color-bg-surface-hover);
	}

	/* Thumbnail */
	.asset-thumb {
		height: 120px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-bg-canvas);
		overflow: hidden;
		flex-shrink: 0;
	}

	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-text {
		font-family: var(--font-family-mono);
		font-size: 0.625rem;
		color: var(--color-text-secondary);
		padding: var(--spacing-2);
		margin: 0;
		overflow: hidden;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 100%;
		line-height: 1.4;
	}

	/* Card body */
	.asset-body {
		padding: var(--spacing-3);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		flex: 1;
	}

	.asset-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-primary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mime-badge {
		display: inline-block;
		padding: 1px var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: 0.6875rem;
		font-family: var(--font-family-mono);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.asset-meta {
		display: flex;
		gap: var(--spacing-2);
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-wrap: wrap;
	}

	/* Delete button */
	.delete-btn {
		position: absolute;
		top: var(--spacing-2);
		right: var(--spacing-2);
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-full);
		color: var(--color-text-muted);
		cursor: pointer;
		opacity: 0;
		transition:
			opacity var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default),
			background-color var(--duration-fast) var(--easing-default);
		padding: 0;
	}

	.asset-card:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		color: var(--color-status-failed);
		background-color: var(--color-port-video-subtle);
		border-color: var(--color-status-failed);
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-4);
		padding: var(--spacing-12) var(--spacing-8);
		color: var(--color-text-muted);
	}

	.empty-icon {
		opacity: 0.4;
	}

	.empty-text {
		font-size: 0.875rem;
		margin: 0;
		text-align: center;
	}

	/* Spin animation for upload indicator */
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.spin {
		animation: spin 0.8s linear infinite;
	}
</style>
