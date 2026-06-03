import { Elysia, t } from 'elysia';
import { status } from 'elysia/error';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { pipelines, pipelineNodes } from '../../db/schema';
import { adapterRegistry } from '../../adapters';

export const schemaRoutes = new Elysia({ prefix: '/pipelines' }).get(
	'/:id/schema',
	async ({ params }) => {
		const pipeline = await db.select().from(pipelines).where(eq(pipelines.id, params.id)).get();
		if (!pipeline) return status(404, { message: 'Pipeline not found' });

		const nodes = await db
			.select()
			.from(pipelineNodes)
			.where(eq(pipelineNodes.pipelineId, params.id))
			.all();

		const steps: Record<
			string,
			{
				inputs: Record<string, unknown>;
				outputs: Record<string, unknown>;
			}
		> = {};

		for (const node of nodes) {
			const adapter = adapterRegistry.get(node.adapterId);
			if (!adapter) continue;

			const inputs: Record<string, unknown> = {};
			for (const port of adapter.inputPorts) {
				inputs[port.name] = port.schema ?? null;
			}

			const outputs: Record<string, unknown> = {};
			for (const port of adapter.outputPorts) {
				outputs[port.name] = port.schema ?? null;
			}

			steps[node.label ?? node.id] = { inputs, outputs };
		}

		return { steps };
	},
	{ params: t.Object({ id: t.String() }) }
);
