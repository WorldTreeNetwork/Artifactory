import { Elysia, t } from 'elysia';
import { status } from 'elysia/error';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { pipelines, pipelineNodes, pipelineEdges } from '../../db/schema';
import { adapterRegistry } from '../../adapters';
import { topologicalSort } from '../../engine/dag';

export const pipelineRoutes = new Elysia({ prefix: '/pipelines' })
	// --- Pipeline CRUD ---
	.get(
		'/',
		async ({ query }) => {
			const conditions = [];
			if (query.status) conditions.push(eq(pipelines.status, query.status));

			const where = conditions.length > 0 ? and(...conditions) : undefined;
			return db
				.select()
				.from(pipelines)
				.where(where)
				.limit(query.limit ?? 50)
				.offset(query.offset ?? 0)
				.all();
		},
		{
			query: t.Object({
				status: t.Optional(
					t.Union([t.Literal('draft'), t.Literal('active'), t.Literal('archived')])
				),
				limit: t.Optional(t.Number()),
				offset: t.Optional(t.Number())
			})
		}
	)
	.post(
		'/',
		async ({ body }) => {
			const [pipeline] = await db
				.insert(pipelines)
				.values({ name: body.name, description: body.description })
				.returning();
			return pipeline;
		},
		{
			body: t.Object({
				name: t.String(),
				description: t.Optional(t.String())
			})
		}
	)
	.get(
		'/:id',
		async ({ params }) => {
			const pipeline = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
			if (!pipeline) return status(404, { message: 'Pipeline not found' });

			const nodes = await db
				.select()
				.from(pipelineNodes)
				.where(eq(pipelineNodes.pipelineId, params.id))
				.all();
			const edges = await db
				.select()
				.from(pipelineEdges)
				.where(eq(pipelineEdges.pipelineId, params.id))
				.all();

			const nodesWithAdapters = nodes.map((node) => {
				const adapter = adapterRegistry.get(node.adapterId);
				return {
					...node,
					adapter: adapter
						? {
								name: adapter.name,
								category: adapter.category,
								inputPorts: adapter.inputPorts,
								outputPorts: adapter.outputPorts
							}
						: null
				};
			});

			return { ...pipeline, nodes: nodesWithAdapters, edges };
		},
		{ params: t.Object({ id: t.String() }) }
	)
	.put(
		'/:id',
		async ({ params, body }) => {
			const existing = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
			if (!existing) return status(404, { message: 'Pipeline not found' });

			const [updated] = await db
				.update(pipelines)
				.set({ ...body, updatedAt: new Date() })
				.where(eq(pipelines.id, params.id))
				.returning();
			return updated;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				name: t.Optional(t.String()),
				description: t.Optional(t.String()),
				status: t.Optional(
					t.Union([t.Literal('draft'), t.Literal('active'), t.Literal('archived')])
				)
			})
		}
	)
	.delete(
		'/:id',
		async ({ params }) => {
			const existing = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
			if (!existing) return status(404, { message: 'Pipeline not found' });
			await db.delete(pipelines).where(eq(pipelines.id, params.id));
			return { success: true };
		},
		{ params: t.Object({ id: t.String() }) }
	)

	// --- Nodes ---
	.post(
		'/:id/nodes',
		async ({ params, body }) => {
			const pipeline = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
			if (!pipeline) return status(404, { message: 'Pipeline not found' });

			const adapter = adapterRegistry.get(body.adapterId);
			if (!adapter) return status(400, { message: `Adapter "${body.adapterId}" not found` });

			const [node] = await db
				.insert(pipelineNodes)
				.values({
					pipelineId: params.id,
					adapterId: body.adapterId,
					config: body.config ?? {},
					positionX: body.positionX ?? 0,
					positionY: body.positionY ?? 0,
					label: body.label ?? adapter.name
				})
				.returning();

			return {
				...node,
				adapter: {
					name: adapter.name,
					category: adapter.category,
					inputPorts: adapter.inputPorts,
					outputPorts: adapter.outputPorts
				}
			};
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				adapterId: t.String(),
				config: t.Optional(t.Record(t.String(), t.Unknown())),
				positionX: t.Optional(t.Number()),
				positionY: t.Optional(t.Number()),
				label: t.Optional(t.String())
			})
		}
	)
	.put(
		'/:id/nodes/:nodeId',
		async ({ params, body }) => {
			const node = await db
				.select()
				.from(pipelineNodes)
				.where(and(eq(pipelineNodes.id, params.nodeId), eq(pipelineNodes.pipelineId, params.id)))
				.get();
			if (!node) return status(404, { message: 'Node not found' });

			const [updated] = await db
				.update(pipelineNodes)
				.set(body)
				.where(eq(pipelineNodes.id, params.nodeId))
				.returning();
			return updated;
		},
		{
			params: t.Object({ id: t.String(), nodeId: t.String() }),
			body: t.Object({
				config: t.Optional(t.Record(t.String(), t.Unknown())),
				positionX: t.Optional(t.Number()),
				positionY: t.Optional(t.Number()),
				label: t.Optional(t.String())
			})
		}
	)
	.delete(
		'/:id/nodes/:nodeId',
		async ({ params }) => {
			const node = await db
				.select()
				.from(pipelineNodes)
				.where(and(eq(pipelineNodes.id, params.nodeId), eq(pipelineNodes.pipelineId, params.id)))
				.get();
			if (!node) return status(404, { message: 'Node not found' });

			await db.delete(pipelineNodes).where(eq(pipelineNodes.id, params.nodeId));
			return { success: true };
		},
		{ params: t.Object({ id: t.String(), nodeId: t.String() }) }
	)

	// --- Edges ---
	.post(
		'/:id/edges',
		async ({ params, body }) => {
			const pipeline = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
			if (!pipeline) return status(404, { message: 'Pipeline not found' });

			// Validate both nodes exist and belong to this pipeline
			const nodes = await db
				.select()
				.from(pipelineNodes)
				.where(eq(pipelineNodes.pipelineId, params.id))
				.all();
			const nodeMap = new Map(nodes.map((n) => [n.id, n]));

			const sourceNode = nodeMap.get(body.sourceNodeId);
			const targetNode = nodeMap.get(body.targetNodeId);
			if (!sourceNode) return status(400, { message: 'Source node not found in this pipeline' });
			if (!targetNode) return status(400, { message: 'Target node not found in this pipeline' });

			// Validate ports exist
			const sourceAdapter = adapterRegistry.get(sourceNode.adapterId);
			const targetAdapter = adapterRegistry.get(targetNode.adapterId);
			if (!sourceAdapter?.outputPorts.some((p) => p.name === body.sourcePortName)) {
				return status(400, {
					message: `Output port "${body.sourcePortName}" not found on source adapter`
				});
			}
			if (!targetAdapter?.inputPorts.some((p) => p.name === body.targetPortName)) {
				return status(400, {
					message: `Input port "${body.targetPortName}" not found on target adapter`
				});
			}

			// Cycle detection
			const existingEdges = await db
				.select()
				.from(pipelineEdges)
				.where(eq(pipelineEdges.pipelineId, params.id))
				.all();
			const testEdges = [
				...existingEdges,
				{ sourceNodeId: body.sourceNodeId, targetNodeId: body.targetNodeId }
			];
			try {
				topologicalSort(nodes, testEdges);
			} catch {
				return status(400, { message: 'Adding this edge would create a cycle' });
			}

			const [edge] = await db
				.insert(pipelineEdges)
				.values({
					pipelineId: params.id,
					sourceNodeId: body.sourceNodeId,
					sourcePortName: body.sourcePortName,
					targetNodeId: body.targetNodeId,
					targetPortName: body.targetPortName
				})
				.returning();

			return edge;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				sourceNodeId: t.String(),
				sourcePortName: t.String(),
				targetNodeId: t.String(),
				targetPortName: t.String()
			})
		}
	)
	.delete(
		'/:id/edges/:edgeId',
		async ({ params }) => {
			const edge = await db
				.select()
				.from(pipelineEdges)
				.where(and(eq(pipelineEdges.id, params.edgeId), eq(pipelineEdges.pipelineId, params.id)))
				.get();
			if (!edge) return status(404, { message: 'Edge not found' });

			await db.delete(pipelineEdges).where(eq(pipelineEdges.id, params.edgeId));
			return { success: true };
		},
		{ params: t.Object({ id: t.String(), edgeId: t.String() }) }
	);
