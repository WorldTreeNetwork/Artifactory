import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const [pipelineRes, schemaRes] = await Promise.all([
		fetch(`/api/pipelines/${params.id}`),
		fetch(`/api/pipelines/${params.id}/schema`)
	]);
	const pipeline = pipelineRes.ok ? await pipelineRes.json() : null;
	const schema = schemaRes.ok ? await schemaRes.json() : null;
	return { pipeline, schema };
};
