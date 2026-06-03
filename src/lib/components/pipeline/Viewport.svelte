<script lang="ts">
	import type { Snippet } from 'svelte';

	type LOD = 'overview' | 'working' | 'detail';

	interface Props {
		zoom?: number;
		pan?: { x: number; y: number };
		minZoom?: number;
		maxZoom?: number;
		children?: Snippet;
	}

	let {
		zoom = $bindable(1.0),
		pan = $bindable({ x: 0, y: 0 }),
		minZoom = 0.25,
		maxZoom = 2.0,
		children
	}: Props = $props();

	const _lod: LOD = $derived(zoom < 0.5 ? 'overview' : zoom <= 1.0 ? 'working' : 'detail');

	export function lod(): LOD {
		return _lod;
	}

	let viewportEl: HTMLDivElement | undefined = $state();

	// Track pointer state for panning
	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let panOrigin = $state({ x: 0, y: 0 });

	function clampZoom(value: number): number {
		return Math.min(maxZoom, Math.max(minZoom, value));
	}

	function applyZoom(delta: number, clientX: number, clientY: number) {
		if (!viewportEl) return;

		const rect = viewportEl.getBoundingClientRect();
		// Mouse position relative to viewport
		const mouseX = clientX - rect.left;
		const mouseY = clientY - rect.top;

		const prevZoom = zoom;
		const newZoom = clampZoom(prevZoom * delta);

		// Adjust pan so zoom centers on mouse position
		// The point under the cursor stays fixed:
		// mouseX = (pointX + pan.x) * zoom  =>  pointX = mouseX / zoom - pan.x / zoom
		// After zoom: mouseX = (pointX + newPan.x) * newZoom
		// => newPan.x = mouseX / newZoom - pointX
		const pointX = mouseX / prevZoom - pan.x / prevZoom;
		const pointY = mouseY / prevZoom - pan.y / prevZoom;

		pan = {
			x: mouseX / newZoom - pointX,
			y: mouseY / newZoom - pointY
		};

		zoom = newZoom;
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();

		// Pinch-to-zoom via ctrlKey + wheel, or plain scroll wheel zoom
		const factor = event.ctrlKey
			? 1 - event.deltaY * 0.01
			: event.deltaY < 0
				? 1.1
				: 1 / 1.1;

		applyZoom(factor, event.clientX, event.clientY);
	}

	function isMiddleButton(event: PointerEvent) {
		return event.button === 1;
	}

	function isPanModifier(event: PointerEvent | MouseEvent) {
		return event.altKey || event.metaKey || event.shiftKey;
	}

	function onPointerDown(event: PointerEvent) {
		if (!isMiddleButton(event) && !isPanModifier(event)) return;

		event.preventDefault();
		isPanning = true;
		panStart = { x: event.clientX, y: event.clientY };
		panOrigin = { x: pan.x, y: pan.y };
		viewportEl?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!isPanning) return;

		const dx = (event.clientX - panStart.x) / zoom;
		const dy = (event.clientY - panStart.y) / zoom;

		pan = {
			x: panOrigin.x + dx,
			y: panOrigin.y + dy
		};
	}

	function onPointerUp(event: PointerEvent) {
		if (!isPanning) return;
		isPanning = false;
		viewportEl?.releasePointerCapture(event.pointerId);
	}

	// Prevent context menu on middle click
	function onContextMenu(event: MouseEvent) {
		if (event.button === 1) event.preventDefault();
	}

	// Cursor style
	let cursor = $derived(isPanning ? 'grabbing' : 'default');

	// CSS transform applied to the content container
	let transform = $derived(`translate(${pan.x * zoom}px, ${pan.y * zoom}px) scale(${zoom})`);

	// Dot grid pattern scales with zoom — dots stay roughly the same visual spacing
	// Base grid size in world units, visible spacing is gridSize * zoom
	const BASE_GRID = 24;
	let dotSpacing = $derived(BASE_GRID * zoom);
	// Dots fade in/out based on zoom for clean LOD
	let dotOpacity = $derived(Math.min(1, Math.max(0, (zoom - 0.2) / 0.3)));
	let dotSize = $derived(Math.max(0.5, 1.5 * Math.min(zoom, 1)));

	// Background pattern offsets track pan so grid tiles correctly
	let bgOffsetX = $derived(((pan.x * zoom) % dotSpacing + dotSpacing) % dotSpacing);
	let bgOffsetY = $derived(((pan.y * zoom) % dotSpacing + dotSpacing) % dotSpacing);
</script>

<div
	bind:this={viewportEl}
	class="viewport"
	style:cursor
	style:--dot-spacing="{dotSpacing}px"
	style:--dot-opacity={dotOpacity}
	style:--dot-size="{dotSize}px"
	style:--bg-offset-x="{bgOffsetX}px"
	style:--bg-offset-y="{bgOffsetY}px"
	role="application"
	aria-label="Pipeline canvas"
	onwheel={onWheel}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	oncontextmenu={onContextMenu}
>
	<div
		class="viewport-content"
		style:transform
		style:transition={isPanning ? 'none' : 'transform 0.1s ease-out'}
	>
		{@render children?.()}
	</div>
</div>

<style>
	.viewport {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background-color: var(--viewport-bg, oklch(0.14 0.01 260));
		background-image: radial-gradient(
			circle,
			oklch(0.45 0.02 260 / var(--dot-opacity)) var(--dot-size),
			transparent var(--dot-size)
		);
		background-size: var(--dot-spacing) var(--dot-spacing);
		background-position: var(--bg-offset-x) var(--bg-offset-y);
		user-select: none;
		touch-action: none;
	}

	.viewport-content {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
		will-change: transform;
	}
</style>
