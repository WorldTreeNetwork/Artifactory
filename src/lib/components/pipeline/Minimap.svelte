<script lang="ts">
	const PADDING = 8;
	const MINIMAP_W = 180;
	const MINIMAP_H = 120;

	interface NodePosition {
		nodeId: string;
		x: number;
		y: number;
		width: number;
		height: number;
		column: number;
	}

	interface Edge {
		sourceNodeId: string;
		targetNodeId: string;
	}

	interface Props {
		positions: NodePosition[];
		edges: Edge[];
		totalWidth: number;
		totalHeight: number;
		viewportWidth: number;
		viewportHeight: number;
		zoom: number;
		pan: { x: number; y: number };
		categoryMap?: Record<string, string>;
		onnavigate?: (pan: { x: number; y: number }) => void;
	}

	let {
		positions,
		edges,
		totalWidth,
		totalHeight,
		viewportWidth,
		viewportHeight,
		zoom,
		pan,
		categoryMap = {},
		onnavigate
	}: Props = $props();

	// Inner drawing area (minimap minus padding on all sides)
	const innerW = MINIMAP_W - PADDING * 2;
	const innerH = MINIMAP_H - PADDING * 2;

	// Scale factors: map pipeline world coords → minimap SVG coords
	const scaleX = $derived(totalWidth > 0 ? innerW / totalWidth : 1);
	const scaleY = $derived(totalHeight > 0 ? innerH / totalHeight : 1);
	// Use uniform scale (fit both dims, keep aspect ratio)
	const scale = $derived(Math.min(scaleX, scaleY));

	// Offset to center the scaled content inside the inner area
	const offsetX = $derived((innerW - totalWidth * scale) / 2);
	const offsetY = $derived((innerH - totalHeight * scale) / 2);

	// Convert world coords → SVG coords within the minimap
	function toMini(wx: number, wy: number): { x: number; y: number } {
		return {
			x: PADDING + offsetX + wx * scale,
			y: PADDING + offsetY + wy * scale
		};
	}

	// Viewport indicator: the visible region in world units
	// pan is in world units (content offset), zoom scales content
	// visible world area: from (-pan.x) to (-pan.x + viewportWidth/zoom)
	const vpLeft = $derived(-pan.x);
	const vpTop = $derived(-pan.y);
	const vpRight = $derived(-pan.x + viewportWidth / zoom);
	const vpBottom = $derived(-pan.y + viewportHeight / zoom);

	const vpRect = $derived((() => {
		const tl = toMini(vpLeft, vpTop);
		const br = toMini(vpRight, vpBottom);
		return {
			x: tl.x,
			y: tl.y,
			width: Math.max(4, br.x - tl.x),
			height: Math.max(4, br.y - tl.y)
		};
	})());

	// Category color CSS variable
	function catColor(nodeId: string): string {
		const category = categoryMap[nodeId];
		if (!category) return 'var(--color-cat-source)';
		return `var(--color-cat-${category})`;
	}

	// Click on minimap → navigate
	let minimapEl: SVGSVGElement | undefined = $state();
	let isDragging = $state(false);

	function svgToWorld(svgX: number, svgY: number): { x: number; y: number } {
		// svgX/Y are in the SVG coordinate space
		const worldX = (svgX - PADDING - offsetX) / scale;
		const worldY = (svgY - PADDING - offsetY) / scale;
		return { x: worldX, y: worldY };
	}

	function navigate(svgX: number, svgY: number) {
		if (!onnavigate) return;
		const world = svgToWorld(svgX, svgY);
		// Center the viewport on the clicked world point
		const newPanX = -(world.x - viewportWidth / zoom / 2);
		const newPanY = -(world.y - viewportHeight / zoom / 2);
		onnavigate({ x: newPanX, y: newPanY });
	}

	function getSvgCoords(event: MouseEvent): { x: number; y: number } {
		if (!minimapEl) return { x: 0, y: 0 };
		const rect = minimapEl.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	function onMouseDown(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = true;
		const coords = getSvgCoords(event);
		navigate(coords.x, coords.y);
	}

	function onMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		const coords = getSvgCoords(event);
		navigate(coords.x, coords.y);
	}

	function onMouseUp() {
		isDragging = false;
	}

	// Edge center lookup: nodeId → center of tile in world coords
	function nodeCenter(nodeId: string): { x: number; y: number } | null {
		const pos = positions.find((p) => p.nodeId === nodeId);
		if (!pos) return null;
		return { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
	}
</script>

<svelte:window on:mouseup={onMouseUp} on:mousemove={onMouseMove} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={minimapEl}
	class="minimap"
	width={MINIMAP_W}
	height={MINIMAP_H}
	viewBox="0 0 {MINIMAP_W} {MINIMAP_H}"
	aria-label="Pipeline minimap"
	role="img"
	onmousedown={onMouseDown}
>
	<!-- Background -->
	<rect
		x="0"
		y="0"
		width={MINIMAP_W}
		height={MINIMAP_H}
		fill="var(--color-bg-surface)"
		rx="8"
		ry="8"
	/>

	<!-- Inner clip so tiles/wires don't bleed outside padding -->
	<clipPath id="minimap-inner-clip">
		<rect x={PADDING} y={PADDING} width={innerW} height={innerH} />
	</clipPath>

	<g clip-path="url(#minimap-inner-clip)">
		<!-- Edges as straight lines -->
		{#each edges as edge (edge.sourceNodeId + '->' + edge.targetNodeId)}
			{@const src = nodeCenter(edge.sourceNodeId)}
			{@const tgt = nodeCenter(edge.targetNodeId)}
			{#if src && tgt}
				{@const ms = toMini(src.x, src.y)}
				{@const mt = toMini(tgt.x, tgt.y)}
				<line
					x1={ms.x}
					y1={ms.y}
					x2={mt.x}
					y2={mt.y}
					stroke="var(--color-border-primary)"
					stroke-width="1"
					opacity="0.6"
				/>
			{/if}
		{/each}

		<!-- Node tiles -->
		{#each positions as pos (pos.nodeId)}
			{@const mp = toMini(pos.x, pos.y)}
			<rect
				x={mp.x}
				y={mp.y}
				width={Math.max(2, pos.width * scale)}
				height={Math.max(2, pos.height * scale)}
				fill={catColor(pos.nodeId)}
				rx="2"
				ry="2"
				opacity="0.85"
			/>
		{/each}

		<!-- Viewport indicator -->
		<rect
			x={vpRect.x}
			y={vpRect.y}
			width={vpRect.width}
			height={vpRect.height}
			fill="var(--color-border-focus)"
			fill-opacity="0.1"
			stroke="var(--color-border-focus)"
			stroke-width="1.5"
			rx="2"
			ry="2"
		/>
	</g>

	<!-- Border over the top so it clips cleanly -->
	<rect
		x="0.75"
		y="0.75"
		width={MINIMAP_W - 1.5}
		height={MINIMAP_H - 1.5}
		fill="none"
		stroke="var(--color-border-primary)"
		stroke-width="1"
		rx="7.5"
		ry="7.5"
	/>
</svg>

<style>
	.minimap {
		position: absolute;
		bottom: 12px;
		right: 12px;
		z-index: var(--z-minimap);
		cursor: crosshair;
		box-shadow: var(--shadow-md);
		border-radius: var(--radius-md);
		display: block;
		/* Prevent viewport pan gestures from bubbling through the minimap */
		touch-action: none;
	}

	.minimap:hover {
		box-shadow: var(--shadow-lg);
	}
</style>
