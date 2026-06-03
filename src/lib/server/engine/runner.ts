import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
	pipelines,
	pipelineNodes,
	pipelineEdges,
	pipelineRuns,
	nodeRuns,
	assets
} from '../db/schema';
import { adapterRegistry } from '../adapters';
import type { AssetRow } from '../adapters/types';
import { storage } from '../storage';
import { topologicalSort, getAllDownstream } from './dag';
import { NodeRunLogger } from './logger';

/**
 * Execute a pipeline. Creates a run record and processes nodes in topological order.
 * Returns the run ID immediately — execution happens in the background.
 */
export async function executePipeline(
	pipelineId: string,
	options?: {
		trigger?: 'manual' | 'schedule' | 'webhook';
		inputs?: Record<string, { assetId: string }>;
	}
): Promise<string> {
	const pipeline = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId)).get();
	if (!pipeline) throw new Error(`Pipeline "${pipelineId}" not found`);
	if (pipeline.status !== 'active')
		throw new Error(`Pipeline "${pipelineId}" is not active (status: ${pipeline.status})`);

	const nodes = await db
		.select()
		.from(pipelineNodes)
		.where(eq(pipelineNodes.pipelineId, pipelineId))
		.all();
	const edges = await db
		.select()
		.from(pipelineEdges)
		.where(eq(pipelineEdges.pipelineId, pipelineId))
		.all();

	// Create the run record
	const [run] = await db
		.insert(pipelineRuns)
		.values({
			pipelineId,
			status: 'pending',
			trigger: options?.trigger ?? 'manual'
		})
		.returning();

	// Apply pre-attached inputs to node configs
	if (options?.inputs) {
		for (const [nodeId, { assetId }] of Object.entries(options.inputs)) {
			const node = nodes.find((n) => n.id === nodeId);
			if (node) {
				const config = (node.config ?? {}) as Record<string, unknown>;
				config.assetId = assetId;
				await db.update(pipelineNodes).set({ config }).where(eq(pipelineNodes.id, nodeId));
				node.config = config;
			}
		}
	}

	// Create node_run records
	const nodeRunRecords = await Promise.all(
		nodes.map((node) =>
			db
				.insert(nodeRuns)
				.values({ pipelineRunId: run.id, nodeId: node.id, status: 'pending' })
				.returning()
				.then((r) => r[0])
		)
	);

	const nodeRunMap = new Map(nodeRunRecords.map((nr) => [nr.nodeId, nr]));

	// Fire-and-forget execution
	runPipeline(run.id, nodes, edges, nodeRunMap).catch((err) => {
		console.error(`Pipeline run ${run.id} failed unexpectedly:`, err);
	});

	return run.id;
}

async function runPipeline(
	runId: string,
	nodes: (typeof pipelineNodes.$inferSelect)[],
	edges: (typeof pipelineEdges.$inferSelect)[],
	nodeRunMap: Map<string, typeof nodeRuns.$inferSelect>
): Promise<void> {
	// Set run to running
	await db
		.update(pipelineRuns)
		.set({ status: 'running', startedAt: new Date() })
		.where(eq(pipelineRuns.id, runId));

	const run = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).get();
	if (!run) return;

	let executionOrder: string[];
	try {
		executionOrder = topologicalSort(nodes, edges);
	} catch {
		await db
			.update(pipelineRuns)
			.set({ status: 'failed', completedAt: new Date() })
			.where(eq(pipelineRuns.id, runId));
		return;
	}

	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	// Track outputs: nodeId -> portName -> Asset
	const outputMap = new Map<string, Map<string, AssetRow>>();

	for (const nodeId of executionOrder) {
		const node = nodeMap.get(nodeId)!;
		const nodeRun = nodeRunMap.get(nodeId)!;

		// Check if this run was cancelled
		const currentRun = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).get();
		if (currentRun?.status === 'cancelled') {
			await db.update(nodeRuns).set({ status: 'skipped' }).where(eq(nodeRuns.id, nodeRun.id));
			continue;
		}

		// Check if node was marked as skipped (due to upstream failure)
		const currentNodeRun = await db
			.select()
			.from(nodeRuns)
			.where(eq(nodeRuns.id, nodeRun.id))
			.get();
		if (currentNodeRun?.status === 'skipped') continue;

		// Set node to running
		await db
			.update(nodeRuns)
			.set({ status: 'running', startedAt: new Date() })
			.where(eq(nodeRuns.id, nodeRun.id));

		// Gather inputs from upstream edges
		const inputs: Record<string, AssetRow> = {};
		for (const edge of edges.filter((e) => e.targetNodeId === nodeId)) {
			const sourceOutputs = outputMap.get(edge.sourceNodeId);
			const asset = sourceOutputs?.get(edge.sourcePortName);
			if (asset) {
				inputs[edge.targetPortName] = asset;
			}
		}

		// Get adapter
		const adapter = adapterRegistry.get(node.adapterId);
		if (!adapter) {
			await markNodeFailed(
				nodeRun.id,
				`Adapter "${node.adapterId}" not found`,
				[],
				nodeId,
				edges,
				nodeRunMap
			);
			await db
				.update(pipelineRuns)
				.set({ status: 'failed', completedAt: new Date() })
				.where(eq(pipelineRuns.id, runId));
			return;
		}

		// Execute adapter
		const logger = new NodeRunLogger();
		const startTime = Date.now();

		try {
			const result = await adapter.execute({
				inputs,
				config: (node.config ?? {}) as Record<string, unknown>,
				run,
				storage,
				logger
			});

			const durationMs = Date.now() - startTime;

			// Store output assets
			const nodeOutputs = new Map<string, AssetRow>();
			for (const [portName, asset] of Object.entries(result.outputs)) {
				// Update asset with run context if it doesn't have one
				if (!asset.pipelineRunId) {
					await db
						.update(assets)
						.set({ pipelineRunId: runId, sourceNodeId: nodeId, sourceNodeRunId: nodeRun.id })
						.where(eq(assets.id, asset.id));
				}
				nodeOutputs.set(portName, asset);
			}
			outputMap.set(nodeId, nodeOutputs);

			// Mark node as completed
			await db
				.update(nodeRuns)
				.set({
					status: 'completed',
					completedAt: new Date(),
					durationMs,
					logs: result.logs
				})
				.where(eq(nodeRuns.id, nodeRun.id));
		} catch (err) {
			const durationMs = Date.now() - startTime;
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error(errorMessage);

			await markNodeFailed(
				nodeRun.id,
				errorMessage,
				logger.getEntries(),
				nodeId,
				edges,
				nodeRunMap,
				durationMs
			);
			await db
				.update(pipelineRuns)
				.set({ status: 'failed', completedAt: new Date() })
				.where(eq(pipelineRuns.id, runId));
			return;
		}
	}

	// All nodes completed successfully
	await db
		.update(pipelineRuns)
		.set({ status: 'completed', completedAt: new Date() })
		.where(eq(pipelineRuns.id, runId));
}

async function markNodeFailed(
	nodeRunId: string,
	error: string,
	logs: unknown[],
	nodeId: string,
	edges: { sourceNodeId: string; targetNodeId: string }[],
	nodeRunMap: Map<string, typeof nodeRuns.$inferSelect>,
	durationMs?: number
): Promise<void> {
	await db
		.update(nodeRuns)
		.set({ status: 'failed', completedAt: new Date(), error, logs, durationMs })
		.where(eq(nodeRuns.id, nodeRunId));

	// Skip all downstream nodes
	const downstream = getAllDownstream(nodeId, edges);
	for (const downstreamNodeId of downstream) {
		const downstreamRun = nodeRunMap.get(downstreamNodeId);
		if (downstreamRun) {
			await db.update(nodeRuns).set({ status: 'skipped' }).where(eq(nodeRuns.id, downstreamRun.id));
		}
	}
}
