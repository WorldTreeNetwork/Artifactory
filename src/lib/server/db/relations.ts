import { relations } from 'drizzle-orm';
import { pipelines, pipelineNodes, pipelineEdges, pipelineRuns, nodeRuns, assets } from './schema';

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
	nodes: many(pipelineNodes),
	edges: many(pipelineEdges),
	runs: many(pipelineRuns)
}));

export const pipelineNodesRelations = relations(pipelineNodes, ({ one, many }) => ({
	pipeline: one(pipelines, {
		fields: [pipelineNodes.pipelineId],
		references: [pipelines.id]
	}),
	nodeRuns: many(nodeRuns)
}));

export const pipelineEdgesRelations = relations(pipelineEdges, ({ one }) => ({
	pipeline: one(pipelines, {
		fields: [pipelineEdges.pipelineId],
		references: [pipelines.id]
	}),
	sourceNode: one(pipelineNodes, {
		fields: [pipelineEdges.sourceNodeId],
		references: [pipelineNodes.id],
		relationName: 'sourceEdges'
	}),
	targetNode: one(pipelineNodes, {
		fields: [pipelineEdges.targetNodeId],
		references: [pipelineNodes.id],
		relationName: 'targetEdges'
	})
}));

export const pipelineRunsRelations = relations(pipelineRuns, ({ one, many }) => ({
	pipeline: one(pipelines, {
		fields: [pipelineRuns.pipelineId],
		references: [pipelines.id]
	}),
	nodeRuns: many(nodeRuns),
	assets: many(assets)
}));

export const nodeRunsRelations = relations(nodeRuns, ({ one }) => ({
	pipelineRun: one(pipelineRuns, {
		fields: [nodeRuns.pipelineRunId],
		references: [pipelineRuns.id]
	}),
	node: one(pipelineNodes, {
		fields: [nodeRuns.nodeId],
		references: [pipelineNodes.id]
	})
}));

export const assetsRelations = relations(assets, ({ one }) => ({
	pipelineRun: one(pipelineRuns, {
		fields: [assets.pipelineRunId],
		references: [pipelineRuns.id]
	})
}));
