<script lang="ts" module>
	/**
	 * Returns the CSS variable name suffix for the primary mime type.
	 * e.g. 'image' | 'text' | 'model' | 'audio' | 'video' | 'structured' | 'any'
	 */
	export function getPortTypeColor(mimeTypes: string[]): string {
		const mime = mimeTypes[0] ?? '*/*';
		if (!mime || mime === '*/*') return 'any';
		if (mime.startsWith('image/')) return 'image';
		if (mime.startsWith('text/')) return 'text';
		if (mime.startsWith('model/')) return 'model';
		if (mime.startsWith('audio/')) return 'audio';
		if (mime.startsWith('video/')) return 'video';
		if (mime === 'application/json') return 'structured';
		return 'any';
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

<script lang="ts">
	interface Port {
		name: string;
		description: string;
		mimeTypes: string[];
		required: boolean;
		schema?: Record<string, unknown>;
	}

	interface Props {
		nodeId: string;
		port: Port;
		type: 'input' | 'output';
		lod: 'overview' | 'working' | 'detail';
		connected?: boolean;
	}

	let { nodeId, port, type, lod, connected = false }: Props = $props();

	const portType = $derived(getPortTypeColor(port.mimeTypes));

	const schemaProperties = $derived((): Array<{ key: string; type: string }> => {
		const props = port.schema?.properties;
		if (!props || typeof props !== 'object') return [];
		return Object.entries(props as Record<string, Record<string, unknown>>).map(([key, def]) => ({
			key,
			type: typeof def.type === 'string' ? def.type : 'unknown'
		}));
	});

	// Dot color: connected or required/optional logic
	const dotStyle = $derived((): string => {
		if (connected) {
			return `background-color: var(--color-port-${portType})`;
		}
		if (port.required) {
			return `background-color: var(--color-wire-unconnected)`;
		}
		return `background-color: var(--color-wire-optional)`;
	});

	const portId = $derived(`${nodeId}-${type}-${port.name}`);
</script>

{#if lod === 'working'}
	<div
		class="port-badge port-badge--working"
		class:port-badge--output={type === 'output'}
		title={port.description}
	>
		<span
			class="port-dot"
			style={dotStyle()}
			data-port-id={portId}
			data-port-type={type}
			data-port-node={nodeId}
			data-port-name={port.name}
		></span>
		<span class="port-name" class:port-name--optional={!port.required}>
			{port.name}
		</span>
		{#if !port.required}
			<span class="port-optional-label">opt</span>
		{/if}
	</div>
{:else if lod === 'detail'}
	<div
		class="port-badge port-badge--detail"
		class:port-badge--output={type === 'output'}
		title={port.description}
	>
		{#if type === 'output'}
			{#each port.mimeTypes as mime}
				<span
					class="mime-pill"
					style="background-color: var(--color-port-{mimeToPortType(mime)}-subtle); color: var(--color-port-{mimeToPortType(mime)})"
				>
					{mime}
				</span>
			{/each}
		{/if}
		<span class="port-name" class:port-name--optional={!port.required}>
			{port.name}
		</span>
		{#if !port.required}
			<span class="port-optional-label">opt</span>
		{/if}
		<span
			class="port-dot"
			style={dotStyle()}
			data-port-id={portId}
			data-port-type={type}
			data-port-node={nodeId}
			data-port-name={port.name}
		></span>
		{#if type === 'input'}
			{#each port.mimeTypes as mime}
				<span
					class="mime-pill"
					style="background-color: var(--color-port-{mimeToPortType(mime)}-subtle); color: var(--color-port-{mimeToPortType(mime)})"
				>
					{mime}
				</span>
			{/each}
		{/if}
		{#if schemaProperties().length > 0}
			<div class="schema-fields" class:schema-fields--output={type === 'output'}>
				{#each schemaProperties() as field}
					<span class="schema-field">
						<span class="schema-field-name">{field.key}</span>
						<span class="schema-field-type">{field.type}</span>
					</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.port-badge {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		min-height: var(--port-badge-height);
		padding: 2px 0;
		flex-wrap: wrap;
	}

	.port-badge--output {
		justify-content: flex-end;
	}

	.port-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.port-name {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-family: var(--font-family-mono, monospace);
	}

	.port-name--optional {
		opacity: 0.65;
	}

	.port-optional-label {
		font-size: 0.65rem;
		color: var(--color-text-muted);
		background-color: var(--color-bg-secondary);
		border-radius: var(--radius-sm);
		padding: 0 3px;
	}

	.mime-pill {
		font-size: 0.65rem;
		border-radius: var(--radius-sm);
		padding: 1px 4px;
		font-family: var(--font-family-mono, monospace);
		white-space: nowrap;
	}

	.schema-fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
		width: 100%;
		padding-top: 2px;
	}

	.schema-fields--output {
		justify-content: flex-end;
	}

	.schema-field {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 0.6rem;
		font-family: var(--font-family-mono, monospace);
		color: var(--color-text-muted);
	}

	.schema-field-name {
		font-weight: 400;
	}

	.schema-field-type {
		background-color: var(--color-bg-secondary);
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
		padding: 0 3px;
		font-size: 0.58rem;
	}
</style>
