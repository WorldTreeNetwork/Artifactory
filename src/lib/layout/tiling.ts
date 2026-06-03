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
	group?: string; // group ID if this tile is part of a fan-out group
}

export interface GroupPosition {
	id: string;
	column: number;
	x: number;
	y: number;
	width: number;
	height: number;
	nodeIds: string[];
}

export interface LayoutConfig {
	tileWidth?: number;
	tileHeight?: number;
	columnGap?: number;
	rowGap?: number;
}

export interface LayoutResult {
	positions: TilePosition[];
	groups: GroupPosition[];
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
		return { positions: [], groups: [], totalWidth: 0, totalHeight: 0, columns: 0 };
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

	// Detect fan-out groups: nodes that share a column AND have a common single predecessor.
	// Build predecessor map: nodeId -> Set of sourceNodeIds
	const predecessorMap = new Map<string, Set<string>>();
	for (const node of nodes) predecessorMap.set(node.id, new Set());
	for (const edge of edges) {
		predecessorMap.get(edge.targetNodeId)?.add(edge.sourceNodeId);
	}

	// positionByNodeId for quick bounding-box lookup
	const positionByNodeId = new Map<string, TilePosition>();
	for (const pos of positions) positionByNodeId.set(pos.nodeId, pos);

	const groups: GroupPosition[] = [];
	let groupCounter = 0;

	for (const [col, ids] of columnGroups) {
		if (ids.length < 2) continue;

		// Find sets of nodes in this column that all share exactly one common predecessor.
		// Group them by that shared predecessor.
		const byPredecessor = new Map<string, string[]>();
		for (const id of ids) {
			const preds = predecessorMap.get(id);
			if (preds && preds.size === 1) {
				const pred = [...preds][0];
				if (!byPredecessor.has(pred)) byPredecessor.set(pred, []);
				byPredecessor.get(pred)!.push(id);
			}
		}

		for (const [, memberIds] of byPredecessor) {
			if (memberIds.length < 2) continue;

			const groupId = `group-${groupCounter++}`;

			// Mark each member tile with this group
			for (const id of memberIds) {
				const pos = positionByNodeId.get(id);
				if (pos) pos.group = groupId;
			}

			// Compute bounding box from member tile positions
			const memberPositions = memberIds.map((id) => positionByNodeId.get(id)!);
			const minX = Math.min(...memberPositions.map((p) => p.x));
			const minY = Math.min(...memberPositions.map((p) => p.y));
			const maxX = Math.max(...memberPositions.map((p) => p.x + p.width));
			const maxY = Math.max(...memberPositions.map((p) => p.y + p.height));

			groups.push({
				id: groupId,
				column: col,
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY,
				nodeIds: memberIds
			});
		}
	}

	return { positions, groups, totalWidth, totalHeight, columns: numColumns };
}
