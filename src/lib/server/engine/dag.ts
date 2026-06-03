interface NodeLike {
	id: string;
}

interface EdgeLike {
	sourceNodeId: string;
	targetNodeId: string;
}

/**
 * Kahn's algorithm for topological sorting.
 * Returns node IDs in execution order.
 * Throws if a cycle is detected.
 */
export function topologicalSort(nodes: NodeLike[], edges: EdgeLike[]): string[] {
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

/** Get the set of node IDs that a given node depends on (immediate predecessors). */
export function getNodeDependencies(nodeId: string, edges: EdgeLike[]): Set<string> {
	return new Set(edges.filter((e) => e.targetNodeId === nodeId).map((e) => e.sourceNodeId));
}

/** Get the set of node IDs that depend on a given node (immediate successors). */
export function getNodeDependents(nodeId: string, edges: EdgeLike[]): Set<string> {
	return new Set(edges.filter((e) => e.sourceNodeId === nodeId).map((e) => e.targetNodeId));
}

/** Get all downstream node IDs (transitive dependents). */
export function getAllDownstream(nodeId: string, edges: EdgeLike[]): Set<string> {
	const visited = new Set<string>();
	const queue = [nodeId];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const dependent of getNodeDependents(current, edges)) {
			if (!visited.has(dependent)) {
				visited.add(dependent);
				queue.push(dependent);
			}
		}
	}
	return visited;
}
