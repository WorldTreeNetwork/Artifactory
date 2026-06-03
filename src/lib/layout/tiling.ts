export interface LayoutNode {
	id: string;
	adapterId: string;
}

export interface LayoutEdge {
	sourceNodeId: string;
	targetNodeId: string;
}

export interface TilePosition {
	nodeId: string;
	x: number;
	y: number;
	column: number;
	row: number;
	width: number;
	height: number;
}

export interface LayoutConfig {
	tileWidth?: number;
	tileHeight?: number;
	columnGap?: number;
	rowGap?: number;
}

export interface LayoutResult {
	positions: TilePosition[];
	totalWidth: number;
	totalHeight: number;
	columns: number;
}

/**
 * Kahn's algorithm for topological sort — reimplemented inline so this module
 * is safe to import in browser/client code (no $lib/server dependency).
 * Returns node IDs in topological order.
 * Throws if a cycle is detected.
 */
function topoSort(nodes: LayoutNode[], edges: LayoutEdge[]): string[] {
	const inDegree = new Map<string, number>();
	const adjacency = new Map<string, string[]>();

	for (const node of nodes) {
		inDegree.set(node.id, 0);
		adjacency.set(node.id, []);
	}

	for (const edge of edges) {
		inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
		adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
	}

	const queue: string[] = [];
	for (const [nodeId, degree] of inDegree) {
		if (degree === 0) queue.push(nodeId);
	}

	const sorted: string[] = [];
	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		sorted.push(nodeId);
		for (const downstream of adjacency.get(nodeId) ?? []) {
			const newDegree = (inDegree.get(downstream) ?? 1) - 1;
			inDegree.set(downstream, newDegree);
			if (newDegree === 0) queue.push(downstream);
		}
	}

	if (sorted.length !== nodes.length) {
		const cycleNodes = nodes.filter((n) => !sorted.includes(n.id)).map((n) => n.id);
		throw new Error(`Cycle detected involving nodes: ${cycleNodes.join(', ')}`);
	}

	return sorted;
}

/**
 * Compute the longest-path depth (column index) for each node.
 * A node's column = max(predecessor column) + 1.
 * Root nodes (no incoming edges) land in column 0.
 * Nodes are processed in topological order so predecessors are always resolved first.
 */
function computeColumns(topoOrder: string[], edges: LayoutEdge[]): Map<string, number> {
	const columnOf = new Map<string, number>();

	// Build predecessor map for quick lookup
	const predecessors = new Map<string, string[]>();
	for (const id of topoOrder) predecessors.set(id, []);
	for (const edge of edges) {
		predecessors.get(edge.targetNodeId)?.push(edge.sourceNodeId);
	}

	for (const id of topoOrder) {
		const preds = predecessors.get(id) ?? [];
		if (preds.length === 0) {
			columnOf.set(id, 0);
		} else {
			const maxPredCol = Math.max(...preds.map((p) => columnOf.get(p) ?? 0));
			columnOf.set(id, maxPredCol + 1);
		}
	}

	return columnOf;
}

/**
 * Compute 2D tile positions from pipeline nodes and edges.
 *
 * Algorithm:
 * 1. Topological sort (Kahn's algorithm).
 * 2. Assign each node a column = longest-path depth from any root.
 * 3. Stack nodes within each column vertically (row order = topo order).
 * 4. Pixel positions: x = col * (tileWidth + columnGap), y = row * (tileHeight + rowGap).
 * 5. Centre columns vertically relative to the tallest column.
 */
export function computeLayout(
	nodes: LayoutNode[],
	edges: LayoutEdge[],
	config?: LayoutConfig
): LayoutResult {
	const tileWidth = config?.tileWidth ?? 300;
	const tileHeight = config?.tileHeight ?? 160;
	const columnGap = config?.columnGap ?? 80;
	const rowGap = config?.rowGap ?? 24;

	if (nodes.length === 0) {
		return { positions: [], totalWidth: 0, totalHeight: 0, columns: 0 };
	}

	const topoOrder = topoSort(nodes, edges);
	const columnOf = computeColumns(topoOrder, edges);

	// Group nodes into columns, preserving topo order within each column
	const columnGroups = new Map<number, string[]>();
	for (const id of topoOrder) {
		const col = columnOf.get(id) ?? 0;
		if (!columnGroups.has(col)) columnGroups.set(col, []);
		columnGroups.get(col)!.push(id);
	}

	const numColumns = columnGroups.size === 0 ? 0 : Math.max(...columnGroups.keys()) + 1;

	// Heights per column (number of rows)
	const maxRowsInAnyColumn = Math.max(...[...columnGroups.values()].map((g) => g.length));
	const tallestColumnPx =
		maxRowsInAnyColumn * tileHeight + Math.max(0, maxRowsInAnyColumn - 1) * rowGap;

	const positions: TilePosition[] = [];

	for (const [col, ids] of columnGroups) {
		const columnHeightPx = ids.length * tileHeight + Math.max(0, ids.length - 1) * rowGap;
		// Centre this column vertically within the tallest column
		const verticalOffset = Math.floor((tallestColumnPx - columnHeightPx) / 2);

		for (let row = 0; row < ids.length; row++) {
			const nodeId = ids[row];
			const x = col * (tileWidth + columnGap);
			const y = verticalOffset + row * (tileHeight + rowGap);
			positions.push({ nodeId, x, y, column: col, row, width: tileWidth, height: tileHeight });
		}
	}

	const totalWidth =
		numColumns === 0 ? 0 : numColumns * tileWidth + Math.max(0, numColumns - 1) * columnGap;
	const totalHeight = tallestColumnPx;

	return { positions, totalWidth, totalHeight, columns: numColumns };
}
