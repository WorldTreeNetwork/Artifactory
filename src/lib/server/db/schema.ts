import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const timestamps = {
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
};

// --- Assets ---

export const assets = sqliteTable('assets', {
	id: id(),
	mimeType: text('mime_type').notNull(),
	metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
	storageKey: text('storage_key'),
	size: integer('size').notNull().default(0),
	content: text('content'),
	sourceNodeId: text('source_node_id'),
	sourceNodeRunId: text('source_node_run_id'),
	pipelineRunId: text('pipeline_run_id'),
	...timestamps
});

// --- Pipelines ---

export const pipelines = sqliteTable('pipelines', {
	id: id(),
	name: text('name').notNull(),
	description: text('description').default(''),
	status: text('status', { enum: ['draft', 'active', 'archived'] })
		.notNull()
		.default('draft'),
	...timestamps
});

export const pipelineNodes = sqliteTable('pipeline_nodes', {
	id: id(),
	pipelineId: text('pipeline_id')
		.notNull()
		.references(() => pipelines.id, { onDelete: 'cascade' }),
	adapterId: text('adapter_id').notNull(),
	config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
	positionX: integer('position_x').notNull().default(0),
	positionY: integer('position_y').notNull().default(0),
	label: text('label').default('')
});

export const pipelineEdges = sqliteTable('pipeline_edges', {
	id: id(),
	pipelineId: text('pipeline_id')
		.notNull()
		.references(() => pipelines.id, { onDelete: 'cascade' }),
	sourceNodeId: text('source_node_id')
		.notNull()
		.references(() => pipelineNodes.id, { onDelete: 'cascade' }),
	sourcePortName: text('source_port_name').notNull(),
	targetNodeId: text('target_node_id')
		.notNull()
		.references(() => pipelineNodes.id, { onDelete: 'cascade' }),
	targetPortName: text('target_port_name').notNull()
});

// --- Pipeline Runs ---

export const pipelineRuns = sqliteTable('pipeline_runs', {
	id: id(),
	pipelineId: text('pipeline_id')
		.notNull()
		.references(() => pipelines.id),
	status: text('status', {
		enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
	})
		.notNull()
		.default('pending'),
	trigger: text('trigger', { enum: ['manual', 'schedule', 'webhook'] })
		.notNull()
		.default('manual'),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	completedAt: integer('completed_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const nodeRuns = sqliteTable('node_runs', {
	id: id(),
	pipelineRunId: text('pipeline_run_id')
		.notNull()
		.references(() => pipelineRuns.id, { onDelete: 'cascade' }),
	nodeId: text('node_id')
		.notNull()
		.references(() => pipelineNodes.id),
	status: text('status', {
		enum: ['pending', 'running', 'completed', 'failed', 'skipped']
	})
		.notNull()
		.default('pending'),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	completedAt: integer('completed_at', { mode: 'timestamp' }),
	durationMs: integer('duration_ms'),
	error: text('error'),
	logs: text('logs', { mode: 'json' }).$type<unknown[]>().default([]),
	retryCount: integer('retry_count').notNull().default(0)
});

export * from './auth.schema';
