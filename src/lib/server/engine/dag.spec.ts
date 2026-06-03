import { describe, it, expect } from 'vitest';
import { topologicalSort, getNodeDependencies, getNodeDependents, getAllDownstream } from './dag';

const node = (id: string) => ({ id });
const edge = (source: string, target: string) => ({ sourceNodeId: source, targetNodeId: target });

describe('topologicalSort', () => {
	it('sorts a linear chain', () => {
		const nodes = [node('a'), node('b'), node('c')];
		const edges = [edge('a', 'b'), edge('b', 'c')];
		const result = topologicalSort(nodes, edges);
		expect(result).toEqual(['a', 'b', 'c']);
	});

	it('sorts a diamond DAG', () => {
		const nodes = [node('a'), node('b'), node('c'), node('d')];
		const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
		const result = topologicalSort(nodes, edges);
		expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'));
		expect(result.indexOf('a')).toBeLessThan(result.indexOf('c'));
		expect(result.indexOf('b')).toBeLessThan(result.indexOf('d'));
		expect(result.indexOf('c')).toBeLessThan(result.indexOf('d'));
	});

	it('handles a single node with no edges', () => {
		expect(topologicalSort([node('a')], [])).toEqual(['a']);
	});

	it('handles disconnected nodes', () => {
		const nodes = [node('a'), node('b'), node('c')];
		const result = topologicalSort(nodes, []);
		expect(result).toHaveLength(3);
		expect(result).toContain('a');
		expect(result).toContain('b');
		expect(result).toContain('c');
	});

	it('throws on a cycle', () => {
		const nodes = [node('a'), node('b'), node('c')];
		const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')];
		expect(() => topologicalSort(nodes, edges)).toThrow(/Cycle detected/);
	});

	it('throws on a self-loop', () => {
		const nodes = [node('a')];
		const edges = [edge('a', 'a')];
		expect(() => topologicalSort(nodes, edges)).toThrow(/Cycle detected/);
	});
});

describe('getNodeDependencies', () => {
	it('returns immediate predecessors', () => {
		const edges = [edge('a', 'c'), edge('b', 'c')];
		expect(getNodeDependencies('c', edges)).toEqual(new Set(['a', 'b']));
	});

	it('returns empty set for root nodes', () => {
		const edges = [edge('a', 'b')];
		expect(getNodeDependencies('a', edges)).toEqual(new Set());
	});
});

describe('getNodeDependents', () => {
	it('returns immediate successors', () => {
		const edges = [edge('a', 'b'), edge('a', 'c')];
		expect(getNodeDependents('a', edges)).toEqual(new Set(['b', 'c']));
	});
});

describe('getAllDownstream', () => {
	it('returns all transitive dependents', () => {
		const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')];
		expect(getAllDownstream('a', edges)).toEqual(new Set(['b', 'c', 'd']));
	});

	it('handles branching', () => {
		const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
		expect(getAllDownstream('a', edges)).toEqual(new Set(['b', 'c', 'd']));
	});

	it('returns empty set for leaf nodes', () => {
		const edges = [edge('a', 'b')];
		expect(getAllDownstream('b', edges)).toEqual(new Set());
	});
});
