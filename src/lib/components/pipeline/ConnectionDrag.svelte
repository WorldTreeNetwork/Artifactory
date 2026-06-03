<script lang="ts">
	interface Props {
		active: boolean;
		sourcePort: {
			nodeId: string;
			portName: string;
			type: 'input' | 'output';
			element: HTMLElement;
		} | null;
		mousePosition: { x: number; y: number };
		compatiblePorts?: Array<{ nodeId: string; portName: string }>;
		container?: HTMLElement;
		zoom?: number;
	}

	let {
		active,
		sourcePort,
		mousePosition,
		compatiblePorts = [],
		container,
		zoom = 1
	}: Props = $props();

	function getPortCenter(portId: string): { x: number; y: number } | null {
		if (!container) return null;
		const el = container.querySelector<HTMLElement>(`[data-port-id="${portId}"]`);
		if (!el) return null;
		const containerRect = container.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		return {
			x: (elRect.left + elRect.width / 2 - containerRect.left) / zoom,
			y: (elRect.top + elRect.height / 2 - containerRect.top) / zoom
		};
	}

	interface PreviewWire {
		d: string;
		color: string;
	}

	const previewWire = $derived((): PreviewWire | null => {
		if (!active || !sourcePort) return null;

		const portId = `${sourcePort.nodeId}-${sourcePort.type}-${sourcePort.portName}`;
		const src = getPortCenter(portId);
		if (!src) return null;

		const tx = mousePosition.x;
		const ty = mousePosition.y;

		let sx: number, sy: number;
		if (sourcePort.type === 'output') {
			sx = src.x;
			sy = src.y;
		} else {
			// For input ports dragged from, the wire goes to the left
			sx = src.x;
			sy = src.y;
		}

		const dx = Math.abs(tx - sx);
		const cpx = Math.max(40, dx * 0.4);

		let d: string;
		if (sourcePort.type === 'output') {
			d = `M ${sx},${sy} C ${sx + cpx},${sy} ${tx - cpx},${ty} ${tx},${ty}`;
		} else {
			d = `M ${tx},${ty} C ${tx + cpx},${ty} ${sx - cpx},${sy} ${sx},${sy}`;
		}

		// Derive color from port mime types via the data attribute
		const portEl = sourcePort.element;
		const portName = portEl.getAttribute('data-port-name') ?? '';
		const nodeId = portEl.getAttribute('data-port-node') ?? '';
		const sourcePortId = `${nodeId}-output-${portName}`;
		// Try to read color from container's sibling WireLayer via CSS variable lookup;
		// fall back to port-type color derived from data attribute on the dot element
		const color = 'var(--color-port-any)';

		return { d, color };
	});
</script>

{#if active && previewWire()}
	{@const wire = previewWire()}
	{#if wire}
		<svg
			class="connection-drag-layer"
			aria-hidden="true"
			style="pointer-events: none; overflow: visible; position: absolute; inset: 0; width: 100%; height: 100%; z-index: var(--z-drag-wire, 20);"
		>
			<path
				d={wire.d}
				fill="none"
				stroke={wire.color}
				stroke-width="var(--wire-width, 2)"
				stroke-linecap="round"
				stroke-dasharray="6 4"
				opacity="0.7"
			/>
		</svg>
	{/if}
{/if}

<style>
	.connection-drag-layer {
		top: 0;
		left: 0;
	}
</style>
