import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const [pipelineRes, runRes] = await Promise.all([
		fetch(`/api/pipelines/${params.id}`),
		fetch(`/api/runs/${params.runId}`)
	]);
	const pipeline = pipelineRes.ok ? await pipelineRes.json() : null;
	const run = runRes.ok ? await runRes.json() : null;
	return { pipeline, run };
};
