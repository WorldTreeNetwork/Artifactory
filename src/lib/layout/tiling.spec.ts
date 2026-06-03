import { describe, it, expect } from 'vitest';
import { computeLayout } from './tiling.js';
import type { LayoutNode, LayoutEdge, LayoutConfig } from './tiling.js';

// Helpers
function node(id: string): LayoutNode {
	return { id, adapterId: `adapter-${id}` };
}

function edge(sourceNodeId: string, targetNodeId: string): LayoutEdge {
	return { sourceNodeId, targetNodeId };
}

function posOf(positions: ReturnType<typeof computeLayout>['positions'], nodeId: string) {
	const p = positions.find((p) => p.nodeId === nodeId);
	if (!p) throw new Error(`No position for node "${nodeId}"`);
	return p;
}

describe('computeLayout', () => {
	describe('empty graph', () => {
		it('returns empty positions and zero dimensions', () => {
			const result = computeLayout([], []);
			expect(result.positions).toHaveLength(0);
			expect(result.totalWidth).toBe(0);
			expect(result.totalHeight).toBe(0);
			expect(result.columns).toBe(0);
		});
	});

	describe('single node', () => {
		it('places the node at (0, 0)', () => {
			const result = computeLayout([node('A')], []);
			expect(result.positions).toHaveLength(1);
			const p = posOf(result.positions, 'A');
			expect(p.x).toBe(0);
			expect(p.y).toBe(0);
			expect(p.column).toBe(0);
			expect(p.row).toBe(0);
		});

		it('uses default tile dimensions', () => {
			const result = computeLayout([node('A')], []);
			const p = posOf(result.positions, 'A');
			expect(p.width).toBe(300);
			expect(p.height).toBe(160);
		});

		it('returns correct total dimensions', () => {
			const result = computeLayout([node('A')], []);
			expect(result.totalWidth).toBe(300);
			expect(result.totalHeight).toBe(160);
			expect(result.columns).toBe(1);
		});
	});

	describe('linear chain A→B→C', () => {
		const nodes = [node('A'), node('B'), node('C')];
		const edges = [edge('A', 'B'), edge('B', 'C')];

		it('assigns each node to its own column', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'A').column).toBe(0);
			expect(posOf(result.positions, 'B').column).toBe(1);
			expect(posOf(result.positions, 'C').column).toBe(2);
		});

		it('assigns row 0 to each node (one node per column)', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'A').row).toBe(0);
			expect(posOf(result.positions, 'B').row).toBe(0);
			expect(posOf(result.positions, 'C').row).toBe(0);
		});

		it('computes correct x positions with default gaps', () => {
			const result = computeLayout(nodes, edges);
			// x = col * (300 + 80)
			expect(posOf(result.positions, 'A').x).toBe(0);
			expect(posOf(result.positions, 'B').x).toBe(380);
			expect(posOf(result.positions, 'C').x).toBe(760);
		});

		it('returns 3 columns', () => {
			const result = computeLayout(nodes, edges);
			expect(result.columns).toBe(3);
		});

		it('total width = 3 tiles + 2 gaps', () => {
			const result = computeLayout(nodes, edges);
			expect(result.totalWidth).toBe(3 * 300 + 2 * 80); // 1060
		});
	});

	describe('diamond: A→B, A→C, B→D, C→D', () => {
		const nodes = [node('A'), node('B'), node('C'), node('D')];
		const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')];

		it('places A in column 0', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'A').column).toBe(0);
		});

		it('places B and C in column 1', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'B').column).toBe(1);
			expect(posOf(result.positions, 'C').column).toBe(1);
		});

		it('places D in column 2', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'D').column).toBe(2);
		});

		it('B and C are stacked (rows 0 and 1)', () => {
			const result = computeLayout(nodes, edges);
			const rows = [posOf(result.positions, 'B').row, posOf(result.positions, 'C').row].sort();
			expect(rows).toEqual([0, 1]);
		});

		it('D is in row 0', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'D').row).toBe(0);
		});

		it('returns 3 columns', () => {
			const result = computeLayout(nodes, edges);
			expect(result.columns).toBe(3);
		});

		it('total height is based on the tallest column (2 nodes)', () => {
			const result = computeLayout(nodes, edges);
			// tallest column = 2 nodes: 2*160 + 1*24 = 344
			expect(result.totalHeight).toBe(2 * 160 + 1 * 24);
		});

		it('single-node columns are centred vertically', () => {
			const result = computeLayout(nodes, edges);
			// tallestPx = 344, singleNodePx = 160, offset = floor((344-160)/2) = 92
			const expectedOffset = Math.floor((344 - 160) / 2);
			expect(posOf(result.positions, 'A').y).toBe(expectedOffset);
			expect(posOf(result.positions, 'D').y).toBe(expectedOffset);
		});
	});

	describe('fan-out: A→B, A→C, A→D', () => {
		const nodes = [node('A'), node('B'), node('C'), node('D')];
		const edges = [edge('A', 'B'), edge('A', 'C'), edge('A', 'D')];

		it('places A in column 0', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'A').column).toBe(0);
		});

		it('places B, C, D in column 1', () => {
			const result = computeLayout(nodes, edges);
			expect(posOf(result.positions, 'B').column).toBe(1);
			expect(posOf(result.positions, 'C').column).toBe(1);
			expect(posOf(result.positions, 'D').column).toBe(1);
		});

		it('B, C, D are stacked (rows 0, 1, 2)', () => {
			const result = computeLayout(nodes, edges);
			const rows = [
				posOf(result.positions, 'B').row,
				posOf(result.positions, 'C').row,
				posOf(result.positions, 'D').row
			].sort((a, b) => a - b);
			expect(rows).toEqual([0, 1, 2]);
		});

		it('returns 2 columns', () => {
			const result = computeLayout(nodes, edges);
			expect(result.columns).toBe(2);
		});

		it('total height is based on the tallest column (3 nodes)', () => {
			const result = computeLayout(nodes, edges);
			// 3*160 + 2*24 = 528
			expect(result.totalHeight).toBe(3 * 160 + 2 * 24);
		});
	});

	describe('disconnected nodes', () => {
		it('places each disconnected node in its own column (column 0)', () => {
			// Three isolated nodes — no edges
			const result = computeLayout([node('X'), node('Y'), node('Z')], []);
			expect(posOf(result.positions, 'X').column).toBe(0);
			expect(posOf(result.positions, 'Y').column).toBe(0);
			expect(posOf(result.positions, 'Z').column).toBe(0);
		});

		it('stacks disconnected nodes vertically', () => {
			const result = computeLayout([node('X'), node('Y'), node('Z')], []);
			const rows = result.positions.map((p) => p.row).sort((a, b) => a - b);
			expect(rows).toEqual([0, 1, 2]);
		});

		it('produces a single column', () => {
			const result = computeLayout([node('X'), node('Y'), node('Z')], []);
			expect(result.columns).toBe(1);
		});
	});

	describe('custom config', () => {
		const config: LayoutConfig = {
			tileWidth: 200,
			tileHeight: 100,
			columnGap: 40,
			rowGap: 10
		};

		it('uses custom tile dimensions', () => {
			const result = computeLayout([node('A')], [], config);
			const p = posOf(result.positions, 'A');
			expect(p.width).toBe(200);
			expect(p.height).toBe(100);
		});

		it('uses custom gaps for x positions in a chain', () => {
			const result = computeLayout([node('A'), node('B')], [edge('A', 'B')], config);
			// x of B = 1 * (200 + 40) = 240
			expect(posOf(result.positions, 'B').x).toBe(240);
		});

		it('uses custom row gap for y positions', () => {
			const result = computeLayout([node('A'), node('B')], [], config);
			// Both in col 0; row 1 y = 0 + 1*(100+10) = 110
			const rows = result.positions.sort((a, b) => a.row - b.row);
			expect(rows[1].y).toBe(110);
		});

		it('total width uses custom dimensions', () => {
			const result = computeLayout([node('A'), node('B')], [edge('A', 'B')], config);
			// 2 * 200 + 1 * 40 = 440
			expect(result.totalWidth).toBe(440);
		});
	});

	describe('total dimensions correctness', () => {
		it('single node total dimensions equal tile size', () => {
			const result = computeLayout([node('A')], []);
			expect(result.totalWidth).toBe(300);
			expect(result.totalHeight).toBe(160);
		});

		it('two-column single-row layout', () => {
			const result = computeLayout([node('A'), node('B')], [edge('A', 'B')]);
			expect(result.totalWidth).toBe(300 + 80 + 300); // 680
			expect(result.totalHeight).toBe(160);
		});
	});
});
