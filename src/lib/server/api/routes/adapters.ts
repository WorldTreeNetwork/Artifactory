import { Elysia, t } from 'elysia';
import { status } from 'elysia/error';
import { adapterRegistry } from '../../adapters';

const serializeAdapter = (a: ReturnType<typeof adapterRegistry.get>) => {
	if (!a) return null;
	return {
		id: a.id,
		name: a.name,
		description: a.description,
		category: a.category,
		inputPorts: a.inputPorts,
		outputPorts: a.outputPorts,
		configSchema: a.configSchema
	};
};

export const adapterRoutes = new Elysia({ prefix: '/adapters' })
	.get(
		'/',
		({ query }) => {
			const adapters = query.category
				? adapterRegistry.listByCategory(
						query.category as 'source' | 'generator' | 'transformer' | 'analyzer' | 'sink'
					)
				: adapterRegistry.list();
			return adapters.map(serializeAdapter);
		},
		{
			query: t.Object({
				category: t.Optional(t.String())
			})
		}
	)
	.get(
		'/:id',
		({ params }) => {
			const adapter = adapterRegistry.get(params.id);
			if (!adapter) return status(404, { message: 'Adapter not found' });
			return serializeAdapter(adapter);
		},
		{ params: t.Object({ id: t.String() }) }
	);
