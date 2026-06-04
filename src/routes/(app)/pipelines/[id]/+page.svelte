<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Viewport, StepTile, DetailDrawer, WireLayer, Minimap, CommandPalette, getPortTypeColor } from '$lib/components/pipeline';
	import { computeLayout } from '$lib/layout/tiling';

	let { data } = $props();

	const pipeline = $derived(data.pipeline);

	// Viewport state
	let zoom = $state(1.0);
	let pan = $state({ x: 40, y: 40 });

	// LOD derived from zoom
	type LOD = 'overview' | 'working' | 'detail';
	const lod: LOD = $derived(zoom < 0.5 ? 'overview' : zoom <= 1.0 ? 'working' : 'detail');

	// Mutable local nodes (so delete/update reflect immediately)
	// Must be declared before layout which references it
	let localNodes: typeof pipeline.nodes = $state([]);

	// Keep localNodes in sync with pipeline data
	$effect(() => {
		localNodes = pipeline.nodes;
	});

	// Container element for port hit-testing and coordinate conversion
	let viewportContainerEl = $state<HTMLElement | undefined>(undefined);

	// Viewport pixel dimensions for minimap viewport indicator
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	// Mutable local edges (so new connections reflect immediately)
	let localEdges: typeof pipeline.edges = $state([]);

	// Keep localEdges in sync with pipeline data
	$effect(() => {
		localEdges = pipeline.edges;
	});

	// Layout computation
	const layout = $derived(
		computeLayout(
			localNodes.map((n: { id: string; adapterId: string }) => ({
				id: n.id,
				adapterId: n.adapterId
			})),
			localEdges.map((e: { sourceNodeId: string; targetNodeId: string }) => ({
				sourceNodeId: e.sourceNodeId,
				targetNodeId: e.targetNodeId
			}))
		)
	);

	// Position lookup by nodeId
	const positionMap = $derived(
		new Map(layout.positions.map((p) => [p.nodeId, p]))
	);

	// Category map for minimap coloring: nodeId -> adapter category
	const categoryMap = $derived(
		Object.fromEntries(
			localNodes
				.filter((n: { id: string; adapter: { category: string } | null }) => n.adapter?.category)
				.map((n: { id: string; adapter: { category: string } }) => [n.id, n.adapter.category])
		)
	);

	// Drag-to-connect state
	interface DragState {
		active: boolean;
		sourceNodeId: string;
		sourcePortName: string;
		sourceType: 'input' | 'output';
		sourceElement: HTMLElement | null;
		mouseX: number;
		mouseY: number;
	}

	let dragState = $state<DragState>({
		active: false,
		sourceNodeId: '',
		sourcePortName: '',
		sourceType: 'output',
		sourceElement: null,
		mouseX: 0,
		mouseY: 0
	});

	interface PortDef {
		name: string;
		mimeTypes: string[];
	}

	interface AdapterPorts {
		inputPorts: PortDef[];
		outputPorts: PortDef[];
	}

	// Build a lookup: nodeId -> adapter ports, for compatibility checks
	const adapterPortMap = $derived(
		new Map<string, AdapterPorts>(
			localNodes.map((n: { id: string; adapter: { inputPorts: PortDef[]; outputPorts: PortDef[] } | null }) => [
				n.id,
				{
					inputPorts: n.adapter?.inputPorts ?? [],
					outputPorts: n.adapter?.outputPorts ?? []
				}
			])
		)
	);

	// Check if two sets of mime types are compatible (any overlap, or either has */*)
	function mimesCompatible(a: string[], b: string[]): boolean {
		if (a.includes('*/*') || b.includes('*/*')) return true;
		return a.some((ma) => b.some((mb) => ma === mb || ma.split('/')[0] + '/*' === mb || mb.split('/')[0] + '/*' === ma));
	}

	// Derive compatible target ports while dragging
	const compatiblePorts = $derived((): Array<{ nodeId: string; portName: string }> => {
		if (!dragState.active) return [];

		const srcAdapterPorts = adapterPortMap.get(dragState.sourceNodeId);
		if (!srcAdapterPorts) return [];

		const results: Array<{ nodeId: string; portName: string }> = [];

		for (const [nodeId, ports] of adapterPortMap) {
			// Must be a different node
			if (nodeId === dragState.sourceNodeId) continue;

			if (dragState.sourceType === 'output') {
				// Source is output → compatible targets are inputs
				const srcMimes = srcAdapterPorts.outputPorts.find((p: { name: string }) => p.name === dragState.sourcePortName)?.mimeTypes ?? [];
				for (const port of ports.inputPorts) {
					if (mimesCompatible(srcMimes, port.mimeTypes)) {
						results.push({ nodeId, portName: port.name });
					}
				}
			} else {
				// Source is input → compatible targets are outputs
				const srcMimes = srcAdapterPorts.inputPorts.find((p: { name: string }) => p.name === dragState.sourcePortName)?.mimeTypes ?? [];
				for (const port of ports.outputPorts) {
					if (mimesCompatible(srcMimes, port.mimeTypes)) {
						results.push({ nodeId, portName: port.name });
					}
				}
			}
		}

		return results;
	});

	// Convert viewport client coordinates to content coordinates
	function clientToContent(clientX: number, clientY: number): { x: number; y: number } {
		if (!viewportContainerEl) return { x: clientX, y: clientY };
		const rect = viewportContainerEl.getBoundingClientRect();
		return {
			x: (clientX - rect.left) / zoom,
			y: (clientY - rect.top) / zoom
		};
	}

	// Pointer event handlers for drag-to-connect
	function handlePointerDown(e: PointerEvent) {
		// Only handle primary button; ignore pan modifiers (handled by Viewport)
		if (e.button !== 0 || e.altKey || e.metaKey || e.shiftKey) return;

		const target = e.target as HTMLElement;
		const portDot = target.closest('[data-port-id]') as HTMLElement | null;
		if (!portDot) return;

		const portType = portDot.getAttribute('data-port-type') as 'input' | 'output' | null;
		const nodeId = portDot.getAttribute('data-port-node');
		const portName = portDot.getAttribute('data-port-name');

		if (!portType || !nodeId || !portName) return;

		e.preventDefault();
		e.stopPropagation();

		const pos = clientToContent(e.clientX, e.clientY);

		dragState = {
			active: true,
			sourceNodeId: nodeId,
			sourcePortName: portName,
			sourceType: portType,
			sourceElement: portDot,
			mouseX: pos.x,
			mouseY: pos.y
		};

		// Capture pointer on the viewport container so we get moves outside tiles
		viewportContainerEl?.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragState.active) return;
		const pos = clientToContent(e.clientX, e.clientY);
		dragState.mouseX = pos.x;
		dragState.mouseY = pos.y;
	}

	async function handlePointerUp(e: PointerEvent) {
		if (!dragState.active) return;

		viewportContainerEl?.releasePointerCapture(e.pointerId);

		const target = e.target as HTMLElement;
		const portDot = target.closest('[data-port-id]') as HTMLElement | null;

		if (portDot) {
			const targetType = portDot.getAttribute('data-port-type') as 'input' | 'output' | null;
			const targetNodeId = portDot.getAttribute('data-port-node');
			const targetPortName = portDot.getAttribute('data-port-name');

			if (targetType && targetNodeId && targetPortName && targetNodeId !== dragState.sourceNodeId) {
				// Determine source/target based on port types
				let sourceNodeId: string;
				let sourcePortName: string;
				let targetNodeIdFinal: string;
				let targetPortNameFinal: string;

				if (dragState.sourceType === 'output' && targetType === 'input') {
					sourceNodeId = dragState.sourceNodeId;
					sourcePortName = dragState.sourcePortName;
					targetNodeIdFinal = targetNodeId;
					targetPortNameFinal = targetPortName;
				} else if (dragState.sourceType === 'input' && targetType === 'output') {
					sourceNodeId = targetNodeId;
					sourcePortName = targetPortName;
					targetNodeIdFinal = dragState.sourceNodeId;
					targetPortNameFinal = dragState.sourcePortName;
				} else {
					// Same type — incompatible
					dragState = { ...dragState, active: false, sourceElement: null };
					return;
				}

				// Check compatibility
				const compat = compatiblePorts();
				const isCompatible = compat.some(
					(p) =>
						(dragState.sourceType === 'output'
							? p.nodeId === targetNodeIdFinal && p.portName === targetPortNameFinal
							: p.nodeId === sourceNodeId && p.portName === sourcePortName)
				);

				if (isCompatible) {
					await createEdge(sourceNodeId, sourcePortName, targetNodeIdFinal, targetPortNameFinal);
				}
			}
		}

		dragState = {
			active: false,
			sourceNodeId: '',
			sourcePortName: '',
			sourceType: 'output',
			sourceElement: null,
			mouseX: 0,
			mouseY: 0
		};
	}

	async function createEdge(
		sourceNodeId: string,
		sourcePortName: string,
		targetNodeId: string,
		targetPortName: string
	) {
		const pipelineId = page.params.id;
		const res = await fetch(`/api/pipelines/${pipelineId}/edges`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sourceNodeId, sourcePortName, targetNodeId, targetPortName })
		});
		if (res.ok) {
			const edge = await res.json();
			localEdges = [...localEdges, edge];
		}
	}

	// Port color map for WireLayer: portId -> CSS color variable
	const portColors = $derived(
		Object.fromEntries(
			localNodes.flatMap((n: { id: string; adapter: { outputPorts: Array<{ name: string; mimeTypes: string[] }> } | null }) =>
				(n.adapter?.outputPorts ?? []).map((p: { name: string; mimeTypes: string[] }) => [
					`${n.id}-output-${p.name}`,
					`var(--color-port-${getPortTypeColor(p.mimeTypes)})`
				])
			)
		)
	);

	// Drag preview port color
	const dragPortColor = $derived((): string => {
		if (!dragState.active || !dragState.sourceElement) return 'var(--color-port-any)';
		const nodeId = dragState.sourceNodeId;
		const portName = dragState.sourcePortName;
		const portType = dragState.sourceType;
		const ports = adapterPortMap.get(nodeId);
		if (!ports) return 'var(--color-port-any)';
		const portList = portType === 'output' ? ports.outputPorts : ports.inputPorts;
		const port = portList.find((p: { name: string }) => p.name === portName);
		if (!port) return 'var(--color-port-any)';
		return `var(--color-port-${getPortTypeColor(port.mimeTypes)})`;
	});

	// Apply/remove highlight class on compatible port dots while dragging
	$effect(() => {
		if (!viewportContainerEl) return;

		// Clear all highlights first
		const highlighted = viewportContainerEl.querySelectorAll('.port-dot--compatible');
		highlighted.forEach((el) => el.classList.remove('port-dot--compatible'));

		if (!dragState.active) return;

		const targetPortType = dragState.sourceType === 'output' ? 'input' : 'output';
		for (const cp of compatiblePorts()) {
			const portId = `${cp.nodeId}-${targetPortType}-${cp.portName}`;
			const el = viewportContainerEl.querySelector(`[data-port-id="${portId}"]`);
			el?.classList.add('port-dot--compatible');
		}

		return () => {
			if (!viewportContainerEl) return;
			const toClean = viewportContainerEl.querySelectorAll('.port-dot--compatible');
			toClean.forEach((el) => el.classList.remove('port-dot--compatible'));
		};
	});

	// Selected tile state
	let selectedNodeId = $state<string | null>(null);
	let drawerOpen = $state(false);

	// Derived selected node and its adapter
	const selectedNode = $derived(
		selectedNodeId ? localNodes.find((n: { id: string }) => n.id === selectedNodeId) ?? null : null
	);
	const selectedAdapter = $derived(selectedNode?.adapter ?? null);

	// Open drawer when a node is selected
	$effect(() => {
		drawerOpen = selectedNodeId !== null;
	});

	// Update node label/config via API then reflect locally
	async function handleNodeUpdate(
		nodeId: string,
		changes: { label?: string; config?: Record<string, unknown> }
	) {
		const pipelineId = page.params.id;
		await fetch(`/api/pipelines/${pipelineId}/nodes/${nodeId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(changes)
		});
		// Reflect changes in local state
		localNodes = localNodes.map((n: { id: string; label: string; config: Record<string, unknown> }) =>
			n.id === nodeId ? { ...n, ...changes } : n
		);
	}

	// Delete node via API then remove from local state
	async function handleNodeDelete(nodeId: string) {
		const pipelineId = page.params.id;
		await fetch(`/api/pipelines/${pipelineId}/nodes/${nodeId}`, { method: 'DELETE' });
		localNodes = localNodes.filter((n: { id: string }) => n.id !== nodeId);
		selectedNodeId = null;
		drawerOpen = false;
	}

	// Zoom controls
	function zoomIn() {
		zoom = Math.min(2.0, zoom * 1.2);
	}

	function zoomOut() {
		zoom = Math.max(0.25, zoom / 1.2);
	}

	function zoomReset() {
		zoom = 1.0;
		pan = { x: 40, y: 40 };
	}

	const zoomPercent = $derived(Math.round(zoom * 100));

	// Command palette state
	let paletteOpen = $state(false);
	const adapters = $derived(data.adapters ?? []);

	async function handleAdapterSelect(adapterId: string) {
		const pipelineId = page.params.id;
		const res = await fetch(`/api/pipelines/${pipelineId}/nodes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ adapterId })
		});
		if (res.ok) {
			const node = await res.json();
			localNodes = [...localNodes, node];

			// Auto-connect: if there's a selected node, try to wire output→input
			if (selectedNodeId) {
				const sourceNode = localNodes.find((n: { id: string }) => n.id === selectedNodeId);
				if (sourceNode?.adapter?.outputPorts?.length && node.adapter?.inputPorts?.length) {
					for (const outPort of sourceNode.adapter.outputPorts) {
						for (const inPort of node.adapter.inputPorts) {
							const compatible =
								outPort.mimeTypes.includes('*/*') ||
								inPort.mimeTypes.includes('*/*') ||
								outPort.mimeTypes.some((m: string) => inPort.mimeTypes.includes(m));
							if (compatible) {
								await createEdge(sourceNode.id, outPort.name, node.id, inPort.name);
								break;
							}
						}
						break; // only auto-connect first compatible pair
					}
				}
			}

			selectedNodeId = node.id;
		}
		paletteOpen = false;
	}

	// Ctrl+K / Cmd+K to open palette
	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}

	// Status badge style
	const STATUS_STYLES: Record<string, string> = {
		draft: 'background-color: var(--color-bg-secondary); color: var(--color-text-secondary)',
		active: 'background-color: oklch(0.25 0.08 145); color: oklch(0.75 0.18 145)',
		archived: 'background-color: var(--color-bg-secondary); color: var(--color-text-muted)'
	};

	// Active run state for live status overlay
	interface NodeRunInfo {
		nodeId: string;
		status: string;
		durationMs?: number;
		error?: string | null;
	}

	interface ActiveRun {
		id: string;
		status: string;
		startedAt: string | null;
		completedAt: string | null;
		nodeRuns: NodeRunInfo[];
	}

	let activeRun = $state<ActiveRun | null>(null);
	let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

	// Node status map derived from active run
	const nodeStatusMap = $derived<Record<string, string>>(
		activeRun?.nodeRuns
			? Object.fromEntries(activeRun.nodeRuns.map((nr) => [nr.nodeId, nr.status]))
			: {}
	);

	// Node duration map derived from active run
	const nodeDurationMap = $derived<Record<string, number>>(
		activeRun?.nodeRuns
			? Object.fromEntries(
					activeRun.nodeRuns
						.filter((nr) => nr.durationMs !== undefined)
						.map((nr) => [nr.nodeId, nr.durationMs!])
				)
			: {}
	);

	// Node error map derived from active run
	const nodeErrorMap = $derived<Record<string, string>>(
		activeRun?.nodeRuns
			? Object.fromEntries(
					activeRun.nodeRuns
						.filter((nr) => nr.error)
						.map((nr) => [nr.nodeId, nr.error!])
				)
			: {}
	);

	async function pollRun(runId: string) {
		try {
			const res = await fetch(`/api/runs/${runId}`);
			if (!res.ok) return;
			const run = await res.json();
			activeRun = run;
			// Stop polling when run reaches terminal state
			if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
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

	async function cancelRun() {
		if (!activeRun) return;
		await fetch(`/api/runs/${activeRun.id}/cancel`, { method: 'POST' });
		await pollRun(activeRun.id);
		stopPolling();
	}

	// Run pipeline — POST to API, then start live polling
	async function runPipeline() {
		const id = page.params.id;
		const res = await fetch(`/api/pipelines/${id}/run`, {
			method: 'POST',
			body: JSON.stringify({ trigger: 'manual' }),
			headers: { 'Content-Type': 'application/json' }
		});
		if (res.ok) {
			const data = await res.json();
			const runId = data.runId;
			// Fetch initial run state immediately
			await pollRun(runId);
			// Poll every second while active
			stopPolling();
			pollInterval = setInterval(() => pollRun(runId), 1000);
		}
	}

	// Clean up polling on destroy
	$effect(() => {
		return () => stopPolling();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor-shell">
	<!-- Toolbar -->
	<header class="toolbar">
		<div class="toolbar-left">
			<a href="/pipelines" class="back-link" aria-label="Back to pipelines">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</a>
			<h1 class="pipeline-name">{pipeline.name}</h1>
			<span class="status-badge" style={STATUS_STYLES[pipeline.status] ?? STATUS_STYLES.draft}>
				{pipeline.status}
			</span>
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

			<!-- Run button -->
			<button class="run-btn" onclick={runPipeline} aria-label="Run pipeline">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
					<path d="M4 2.5l8 5.5-8 5.5V2.5z" fill="currentColor"/>
				</svg>
				Run
			</button>
		</div>
	</header>

	<!-- Viewport fills remaining space -->
	<div
		bind:this={viewportContainerEl}
		bind:clientWidth={viewportWidth}
		bind:clientHeight={viewportHeight}
		class="viewport-container"
		role="presentation"
		onclick={(e) => {
			// Clear selection when clicking the viewport background (not a tile)
			if (e.target === e.currentTarget) {
				selectedNodeId = null;
			}
		}}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
	>
		<Viewport bind:zoom bind:pan>
			{#if localNodes.length === 0}
				<div class="empty-canvas">
					<p class="empty-msg">No steps yet. Add an adapter to get started.</p>
				</div>
			{:else}
				{#each localNodes as node (node.id)}
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
								onclick={() => {
									selectedNodeId = selectedNodeId === node.id ? null : node.id;
								}}
							/>
						</div>
					{/if}
				{/each}
			{/if}

			<!-- Wire layer renders edges -->
			<WireLayer
				edges={localEdges}
				positions={layout.positions}
				container={viewportContainerEl}
				{zoom}
				{portColors}
			/>

			<!-- Preview wire while dragging -->
			{#if dragState.active && dragState.sourceElement}
				{@const srcPortId = `${dragState.sourceNodeId}-${dragState.sourceType}-${dragState.sourcePortName}`}
				{@const srcEl = viewportContainerEl?.querySelector(`[data-port-id="${srcPortId}"]`)}
				{#if srcEl && viewportContainerEl}
					{@const containerRect = viewportContainerEl.getBoundingClientRect()}
					{@const srcRect = (srcEl as HTMLElement).getBoundingClientRect()}
					{@const sx = (srcRect.left + srcRect.width / 2 - containerRect.left) / zoom}
					{@const sy = (srcRect.top + srcRect.height / 2 - containerRect.top) / zoom}
					{@const tx = dragState.mouseX}
					{@const ty = dragState.mouseY}
					{@const dx = Math.abs(tx - sx)}
					{@const cpx = Math.max(40, dx * 0.4)}
					{@const d = dragState.sourceType === 'output'
						? `M ${sx},${sy} C ${sx + cpx},${sy} ${tx - cpx},${ty} ${tx},${ty}`
						: `M ${tx},${ty} C ${tx + cpx},${ty} ${sx - cpx},${sy} ${sx},${sy}`}
					<svg
						aria-hidden="true"
						style="pointer-events: none; overflow: visible; position: absolute; inset: 0; width: 100%; height: 100%; z-index: 20;"
					>
						<path
							{d}
							fill="none"
							stroke={dragPortColor()}
							stroke-width="2"
							stroke-linecap="round"
							stroke-dasharray="6 4"
							opacity="0.7"
						/>
					</svg>
				{/if}
			{/if}
		</Viewport>

		<!-- Compatible port highlights overlay (CSS class on port dots) -->
		{#if dragState.active}
			{#each compatiblePorts() as cp}
				{@const portType = dragState.sourceType === 'output' ? 'input' : 'output'}
				{@const portId = `${cp.nodeId}-${portType}-${cp.portName}`}
				{@const portEl = viewportContainerEl?.querySelector(`[data-port-id="${portId}"]`)}
				{#if portEl}
					<!-- We set class via effect instead of here — see $effect below -->
				{/if}
			{/each}
		{/if}

		<!-- Minimap overview -->
		<Minimap
			positions={layout.positions}
			edges={localEdges.map((e: { sourceNodeId: string; targetNodeId: string }) => ({
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

	<!-- Detail Drawer -->
	<DetailDrawer
		bind:open={drawerOpen}
		node={selectedNode}
		adapter={selectedAdapter}
		onupdate={handleNodeUpdate}
		ondelete={handleNodeDelete}
	/>

	<CommandPalette
		bind:open={paletteOpen}
		{adapters}
		onselect={handleAdapterSelect}
	/>
</div>

<style>
	.editor-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* Toolbar */
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
		transition: background-color var(--duration-fast) var(--easing-default),
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

	.pipeline-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 300px;
	}

	.status-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	/* Zoom controls */
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
		transition: background-color var(--duration-fast) var(--easing-default),
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
		transition: background-color var(--duration-fast) var(--easing-default),
			color var(--duration-fast) var(--easing-default);
	}

	.zoom-level:hover {
		background-color: var(--color-bg-surface-hover);
		color: var(--color-text-primary);
	}

	/* Run button */
	.run-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		height: 30px;
		padding: 0 var(--spacing-3);
		border: none;
		border-radius: var(--radius-md);
		background-color: oklch(0.45 0.18 145);
		color: oklch(0.97 0.02 145);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--easing-default);
	}

	.run-btn:hover {
		background-color: oklch(0.52 0.18 145);
	}

	.run-btn:focus-visible {
		outline: 2px solid var(--color-border-focus);
		outline-offset: 2px;
	}

	/* Viewport container fills remaining height */
	.viewport-container {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	/* Empty canvas message */
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

	/* Tile wrapper — absolutely positioned inside viewport */
	.tile-wrapper {
		pointer-events: auto;
	}

	/* Compatible port highlight during drag-to-connect */
	:global(.port-dot--compatible) {
		box-shadow: 0 0 0 3px var(--color-border-focus), 0 0 8px 2px var(--color-border-focus);
		transform: scale(1.6);
		transition:
			box-shadow var(--duration-fast) var(--easing-default),
			transform var(--duration-fast) var(--easing-default);
	}
</style>
