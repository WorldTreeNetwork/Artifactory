import { Elysia, t } from 'elysia';
import { status } from 'elysia/error';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { pipelineRuns, nodeRuns, pipelines, assets } from '../../db/schema';
import { executePipeline } from '../../engine';

export const runRoutes = new Elysia()
	.post(
		'/pipelines/:id/run',
		async ({ params, body }) => {
			const pipeline = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
			if (!pipeline) return status(404, { message: 'Pipeline not found' });
			if (pipeline.status !== 'active')
				return status(400, { message: `Pipeline is not active (status: ${pipeline.status})` });

			const runId = await executePipeline(params.id, {
				trigger: body?.trigger ?? 'manual',
				inputs: body?.inputs
			});

			return { runId };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Optional(
				t.Object({
					trigger: t.Optional(
						t.Union([t.Literal('manual'), t.Literal('schedule'), t.Literal('webhook')])
					),
					inputs: t.Optional(t.Record(t.String(), t.Object({ assetId: t.String() })))
				})
			)
		}
	)
	.get(
		'/pipelines/:id/runs',
		async ({ params, query }) => {
			const conditions = [eq(pipelineRuns.pipelineId, params.id)];
			if (query.status) conditions.push(eq(pipelineRuns.status, query.status));

			return db
				.select()
				.from(pipelineRuns)
				.where(and(...conditions))
				.limit(query.limit ?? 50)
				.offset(query.offset ?? 0)
				.orderBy(pipelineRuns.createdAt)
				.all();
		},
		{
			params: t.Object({ id: t.String() }),
			query: t.Object({
				status: t.Optional(
					t.Union([
						t.Literal('pending'),
						t.Literal('running'),
						t.Literal('completed'),
						t.Literal('failed'),
						t.Literal('cancelled')
					])
				),
				limit: t.Optional(t.Number()),
				offset: t.Optional(t.Number())
			})
		}
	)
	.get(
		'/runs/:runId',
		async ({ params }) => {
			const run = await db
				.select()
				.from(pipelineRuns)
				.where(eq(pipelineRuns.id, params.runId))
				.get();
			if (!run) return status(404, { message: 'Run not found' });

			const nodeRunRows = await db
				.select()
				.from(nodeRuns)
				.where(eq(nodeRuns.pipelineRunId, params.runId))
				.all();

			const nodeRunsWithAssets = await Promise.all(
				nodeRunRows.map(async (nr) => {
					const outputAssets = await db
						.select({ id: assets.id, mimeType: assets.mimeType, size: assets.size })
						.from(assets)
						.where(and(eq(assets.sourceNodeRunId, nr.id), eq(assets.pipelineRunId, params.runId)))
						.all();

					return { ...nr, outputAssets };
				})
			);

			return { ...run, nodeRuns: nodeRunsWithAssets };
		},
		{ params: t.Object({ runId: t.String() }) }
	)
	.post(
		'/runs/:runId/cancel',
		async ({ params }) => {
			const run = await db
				.select()
				.from(pipelineRuns)
				.where(eq(pipelineRuns.id, params.runId))
				.get();
			if (!run) return status(404, { message: 'Run not found' });
			if (run.status !== 'pending' && run.status !== 'running') {
				return status(400, { message: `Cannot cancel run with status "${run.status}"` });
			}

			await db
				.update(pipelineRuns)
				.set({ status: 'cancelled', completedAt: new Date() })
				.where(eq(pipelineRuns.id, params.runId));

			const pendingNodeRuns = await db
				.select()
				.from(nodeRuns)
				.where(eq(nodeRuns.pipelineRunId, params.runId))
				.all();

			for (const nr of pendingNodeRuns) {
				if (nr.status === 'pending' || nr.status === 'running') {
					await db.update(nodeRuns).set({ status: 'skipped' }).where(eq(nodeRuns.id, nr.id));
				}
			}

			return { success: true };
		},
		{ params: t.Object({ runId: t.String() }) }
	);
