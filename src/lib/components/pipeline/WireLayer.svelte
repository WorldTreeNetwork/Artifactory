<script lang="ts">
	interface Edge {
		id: string;
		sourceNodeId: string;
		sourcePortName: string;
		targetNodeId: string;
		targetPortName: string;
	}

	interface TilePos {
		nodeId: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}

	interface WirePath {
		id: string;
		d: string;
		color: string;
	}

	interface Props {
		edges: Edge[];
		positions: TilePos[];
		container?: HTMLElement;
		zoom?: number;
		portColors?: Record<string, string>;
	}

	let { edges, positions, container, zoom = 1, portColors = {} }: Props = $props();

	let wirePaths = $state<WirePath[]>([]);

	function getPortElement(portId: string): HTMLElement | null {
		if (!container) return null;
		return container.querySelector<HTMLElement>(`[data-port-id="${portId}"]`);
	}

	function getContainerRect(): DOMRect | null {
		if (!container) return null;
		return container.getBoundingClientRect();
	}

	function computeWirePaths(): WirePath[] {
		const containerRect = getContainerRect();

		return edges.map((edge) => {
			const sourcePortId = `${edge.sourceNodeId}-output-${edge.sourcePortName}`;
			const targetPortId = `${edge.targetNodeId}-input-${edge.targetPortName}`;

			let sx: number;
			let sy: number;
			let tx: number;
			let ty: number;

			const sourceEl = getPortElement(sourcePortId);
			const targetEl = getPortElement(targetPortId);

			if (sourceEl && targetEl && containerRect) {
				// Use DOM positions, adjusted for container offset and zoom
				const sourceRect = sourceEl.getBoundingClientRect();
				const targetRect = targetEl.getBoundingClientRect();

				sx = (sourceRect.left + sourceRect.width / 2 - containerRect.left) / zoom;
				sy = (sourceRect.top + sourceRect.height / 2 - containerRect.top) / zoom;
				tx = (targetRect.left + targetRect.width / 2 - containerRect.left) / zoom;
				ty = (targetRect.top + targetRect.height / 2 - containerRect.top) / zoom;
			} else {
				// Fallback: use tile positions
				const sourcePos = positions.find((p) => p.nodeId === edge.sourceNodeId);
				const targetPos = positions.find((p) => p.nodeId === edge.targetNodeId);

				if (!sourcePos || !targetPos) {
					return { id: edge.id, d: '', color: 'var(--color-port-any)' };
				}

				sx = sourcePos.x + sourcePos.width;
				sy = sourcePos.y + sourcePos.height / 2;
				tx = targetPos.x;
				ty = targetPos.y + targetPos.height / 2;
			}

			const dx = Math.abs(tx - sx);
			const cpx = Math.max(40, dx * 0.4);
			const d = `M ${sx},${sy} C ${sx + cpx},${sy} ${tx - cpx},${ty} ${tx},${ty}`;

			const color = portColors[sourcePortId] ?? 'var(--color-port-any)';

			return { id: edge.id, d, color };
		});
	}

	$effect(() => {
		// Depend on edges and positions reactively
		edges;
		positions;
		wirePaths = computeWirePaths();
	});

	$effect(() => {
		// After mount, recalculate once DOM elements are rendered
		requestAnimationFrame(() => {
			wirePaths = computeWirePaths();
		});
	});
</script>

<svg
	class="wire-layer"
	style="pointer-events: none; overflow: visible; position: absolute; inset: 0; width: 100%; height: 100%; z-index: var(--z-wires);"
	aria-hidden="true"
>
	{#each wirePaths as wire (wire.id)}
		{#if wire.d}
			<!-- Transparent hit area for easier hover targeting -->
			<path
				class="wire-hit"
				d={wire.d}
				fill="none"
				stroke="transparent"
				stroke-width="8"
				stroke-linecap="round"
				style="pointer-events: stroke;"
			/>
			<!-- Visible wire -->
			<path
				class="wire-visible"
				d={wire.d}
				fill="none"
				stroke={wire.color}
				stroke-width="var(--wire-width)"
				stroke-linecap="round"
				opacity="var(--wire-opacity)"
				style="pointer-events: stroke;"
			/>
		{/if}
	{/each}
</svg>

<style>
	.wire-layer {
		top: 0;
		left: 0;
	}

	.wire-visible {
		transition:
			stroke-width var(--duration-fast) var(--easing-default),
			opacity var(--duration-fast) var(--easing-default);
	}

	/* Hover group: when hit area or visible path is hovered, style the visible wire */
	.wire-hit:hover + .wire-visible,
	.wire-visible:hover {
		stroke-width: var(--wire-width-hover);
		opacity: var(--wire-opacity-hover);
	}
</style>
