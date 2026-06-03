import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const [pipelineRes, runsRes] = await Promise.all([
		fetch(`/api/pipelines/${params.id}`),
		fetch(`/api/pipelines/${params.id}/runs`)
	]);
	const pipeline = pipelineRes.ok ? await pipelineRes.json() : null;
	const runs = runsRes.ok ? await runsRes.json() : [];
	return { pipeline, runs };
};
