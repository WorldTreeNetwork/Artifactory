<script lang="ts">
	import { slide } from 'svelte/transition';
	import { getPortTypeColor } from './PortBadge.svelte';

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
		description: string;
		category: AdapterCategory;
		inputPorts: PortDef[];
		outputPorts: PortDef[];
		configSchema: Record<string, unknown>;
	}

	interface Props {
		open: boolean;
		node: NodeProp | null;
		adapter: AdapterProp | null;
		onupdate?: (nodeId: string, changes: { label?: string; config?: Record<string, unknown> }) => void;
		ondelete?: (nodeId: string) => void;
	}

	let { open = $bindable(), node, adapter, onupdate, ondelete }: Props = $props();

	// Tab state
	type Tab = 'config' | 'ports';
	let activeTab = $state<Tab>('config');

	// Editable form state — reset when node changes
	let editLabel = $state('');
	let editConfig = $state<Record<string, string>>({});

	$effect(() => {
		if (node) {
			editLabel = node.label ?? '';
			editConfig = Object.fromEntries(
				Object.entries(node.config ?? {}).map(([k, v]) => [
					k,
					typeof v === 'string' ? v : JSON.stringify(v)
				])
			);
		}
	});

	// Switch to config tab when a new node is selected
	$effect(() => {
		if (node) {
			activeTab = 'config';
		}
	});

	// Escape key closes
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			open = false;
		}
	}

	function handleSave() {
		if (!node) return;
		// Parse config values back: attempt JSON parse, fall back to string
		const config: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(editConfig)) {
			try {
				config[k] = JSON.parse(v);
			} catch {
				config[k] = v;
			}
		}
		onupdate?.(node.id, { label: editLabel, config });
	}

	function handleDelete() {
		if (!node) return;
		ondelete?.(node.id);
	}

	// Category color style helper
	function categoryStyle(cat: AdapterCategory): string {
		return `background-color: var(--color-cat-${cat}-subtle); color: var(--color-cat-${cat})`;
	}

	function mimeToPortType(mime: string): string {
		if (!mime || mime === '*/*') return 'any';
		if (mime.startsWith('image/')) return 'image';
		if (mime.startsWith('text/')) return 'text';
		if (mime.startsWith('model/')) return 'model';
		if (mime.startsWith('audio/')) return 'audio';
		if (mime.startsWith('video/')) return 'video';
		if (mime === 'application/json') return 'structured';
		return 'any';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open && node}
	<div
		class="drawer"
		role="complementary"
		aria-label="Node configuration"
		transition:slide={{ duration: 200, axis: 'y' }}
	>
		<!-- Drag handle -->
		<div class="drag-handle" aria-hidden="true">
			<span class="drag-handle-bar"></span>
		</div>

		<!-- Drawer header: node label + tabs + close -->
		<div class="drawer-header">
			<div class="drawer-title-row">
				<span class="drawer-node-name" title={node.label || adapter?.name || node.adapterId}>
					{node.label || adapter?.name || node.adapterId}
				</span>
				{#if adapter}
					<span class="category-badge" style={categoryStyle(adapter.category)}>
						{adapter.category}
					</span>
				{/if}
			</div>

			<div class="drawer-controls">
				<!-- Tabs -->
				<div class="tab-bar" role="tablist">
					<button
						class="tab-btn"
						class:tab-btn--active={activeTab === 'config'}
						role="tab"
						aria-selected={activeTab === 'config'}
						onclick={() => (activeTab = 'config')}
					>
						Config
					</button>
					<button
						class="tab-btn"
						class:tab-btn--active={activeTab === 'ports'}
						role="tab"
						aria-selected={activeTab === 'ports'}
						onclick={() => (activeTab = 'ports')}
					>
						Ports
					</button>
				</div>

				<!-- Close button -->
				<button
					class="close-btn"
					onclick={() => (open = false)}
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
			{#if activeTab === 'config'}
				<div class="config-panel">
					<!-- Label field -->
					<div class="field-row">
						<label class="field-label" for="node-label">Label</label>
						<input
							id="node-label"
							class="field-input"
							type="text"
							bind:value={editLabel}
							placeholder={adapter?.name ?? node.adapterId}
						/>
					</div>

					<!-- Adapter info (read-only) -->
					{#if adapter}
						<div class="field-row">
							<span class="field-label">Adapter</span>
							<span class="field-value-readonly">{adapter.name}</span>
						</div>
						{#if adapter.description}
							<div class="field-row field-row--description">
								<span class="field-label">Description</span>
								<span class="field-value-readonly field-value--muted">{adapter.description}</span>
							</div>
						{/if}
					{/if}

					<!-- Config key-value editor -->
					{#if Object.keys(editConfig).length > 0}
						<div class="config-section-label">Configuration</div>
						{#each Object.keys(editConfig) as key}
							<div class="field-row">
								<label class="field-label field-label--mono" for="config-{node.id}-{key}">{key}</label>
								<input
									id="config-{node.id}-{key}"
									class="field-input field-input--mono"
									type="text"
									bind:value={editConfig[key]}
								/>
							</div>
						{/each}
					{:else}
						<div class="empty-config">No configuration fields</div>
					{/if}

					<!-- Save button -->
					<div class="save-row">
						<button class="save-btn" onclick={handleSave}>Save changes</button>
					</div>
				</div>

			{:else if activeTab === 'ports'}
				<div class="ports-panel">
					{#if adapter}
						<!-- Input ports -->
						{#if adapter.inputPorts.length > 0}
							<div class="ports-section-label">Inputs</div>
							<div class="ports-list">
								{#each adapter.inputPorts as port}
									{@const portType = getPortTypeColor(port.mimeTypes)}
									<div class="port-row">
										<span
											class="port-dot"
											style="background-color: var(--color-port-{portType})"
										></span>
										<span class="port-name">{port.name}</span>
										{#if !port.required}
											<span class="port-optional">opt</span>
										{/if}
										<div class="port-mimes">
											{#each port.mimeTypes as mime}
												<span
													class="mime-pill"
													style="background-color: var(--color-port-{mimeToPortType(mime)}-subtle); color: var(--color-port-{mimeToPortType(mime)})"
												>{mime}</span>
											{/each}
										</div>
									</div>
									{#if port.description}
										<div class="port-desc">{port.description}</div>
									{/if}
								{/each}
							</div>
						{/if}

						<!-- Output ports -->
						{#if adapter.outputPorts.length > 0}
							<div class="ports-section-label">Outputs</div>
							<div class="ports-list">
								{#each adapter.outputPorts as port}
									{@const portType = getPortTypeColor(port.mimeTypes)}
									<div class="port-row">
										<span
											class="port-dot"
											style="background-color: var(--color-port-{portType})"
										></span>
										<span class="port-name">{port.name}</span>
										{#if !port.required}
											<span class="port-optional">opt</span>
										{/if}
										<div class="port-mimes">
											{#each port.mimeTypes as mime}
												<span
													class="mime-pill"
													style="background-color: var(--color-port-{mimeToPortType(mime)}-subtle); color: var(--color-port-{mimeToPortType(mime)})"
												>{mime}</span>
											{/each}
										</div>
									</div>
									{#if port.description}
										<div class="port-desc">{port.description}</div>
									{/if}
								{/each}
							</div>
						{/if}

						{#if adapter.inputPorts.length === 0 && adapter.outputPorts.length === 0}
							<div class="empty-config">No ports defined</div>
						{/if}
					{:else}
						<div class="empty-config">Adapter not found — no port information available</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Actions footer — always visible -->
		<div class="drawer-footer">
			<button class="delete-btn" onclick={handleDelete} aria-label="Delete node">
				<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
					<path d="M2 3h9M5 3V2h3v1M4 3v7h5V3H4zM6 5v3M7 5v3" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				Delete node
			</button>
		</div>
	</div>
{/if}

<style>
	.drawer {
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
		cursor: row-resize;
	}

	.drag-handle-bar {
		display: block;
		width: 36px;
		height: 3px;
		border-radius: var(--radius-full);
		background-color: var(--color-border-primary);
	}

	/* Header */
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

	.category-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
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

	/* Body */
	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 0 var(--spacing-4);
	}

	/* Config panel */
	.config-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding-bottom: var(--spacing-2);
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		min-height: 28px;
	}

	.field-row--description {
		align-items: flex-start;
	}

	.field-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		min-width: 90px;
		flex-shrink: 0;
	}

	.field-label--mono {
		font-family: var(--font-family-mono, monospace);
	}

	.field-input {
		flex: 1;
		height: 28px;
		padding: 0 var(--spacing-2);
		background-color: var(--color-bg-surface);
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		color: var(--color-text-primary);
		font-family: var(--font-family-sans, sans-serif);
		transition: border-color var(--duration-fast) var(--easing-default);
		outline: none;
	}

	.field-input--mono {
		font-family: var(--font-family-mono, monospace);
		font-size: 0.75rem;
	}

	.field-input:focus {
		border-color: var(--color-border-focus);
	}

	.field-value-readonly {
		font-size: 0.8125rem;
		color: var(--color-text-primary);
	}

	.field-value--muted {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.config-section-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin-top: var(--spacing-2);
		padding-bottom: var(--spacing-1);
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.empty-config {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		padding: var(--spacing-2) 0;
	}

	.save-row {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border-subtle);
		margin-top: var(--spacing-1);
	}

	.save-btn {
		height: 28px;
		padding: 0 var(--spacing-4);
		border: none;
		border-radius: var(--radius-sm);
		background-color: var(--color-border-focus);
		color: var(--color-text-inverse);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity var(--duration-fast) var(--easing-default);
	}

	.save-btn:hover {
		opacity: 0.85;
	}

	.save-btn:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Ports panel */
	.ports-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding-bottom: var(--spacing-2);
	}

	.ports-section-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin-top: var(--spacing-2);
		padding-bottom: var(--spacing-1);
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.ports-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.port-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-height: 24px;
		padding: 2px 0;
	}

	.port-dot {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.port-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-primary);
		font-family: var(--font-family-mono, monospace);
		flex-shrink: 0;
	}

	.port-optional {
		font-size: 0.65rem;
		color: var(--color-text-muted);
		background-color: var(--color-bg-surface);
		border-radius: var(--radius-sm);
		padding: 0 3px;
		flex-shrink: 0;
	}

	.port-mimes {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.mime-pill {
		font-size: 0.65rem;
		border-radius: var(--radius-sm);
		padding: 1px 4px;
		font-family: var(--font-family-mono, monospace);
		white-space: nowrap;
	}

	.port-desc {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		padding-left: calc(8px + var(--spacing-2));
		padding-bottom: var(--spacing-1);
	}

	/* Footer */
	.drawer-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: var(--spacing-2) var(--spacing-4);
		border-top: 1px solid var(--color-border-subtle);
		flex-shrink: 0;
	}

	.delete-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		height: 28px;
		padding: 0 var(--spacing-3);
		border: 1px solid color-mix(in srgb, var(--color-status-failed) 40%, transparent);
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-status-failed);
		transition:
			background-color var(--duration-fast) var(--easing-default),
			border-color var(--duration-fast) var(--easing-default);
	}

	.delete-btn:hover {
		background-color: color-mix(in srgb, var(--color-status-failed) 10%, transparent);
		border-color: var(--color-status-failed);
	}

	.delete-btn:focus-visible {
		outline: 2px solid var(--color-status-failed);
		outline-offset: 2px;
	}
</style>
