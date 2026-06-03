import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
	const [pipelineRes, adaptersRes] = await Promise.all([
		fetch(`/api/pipelines/${params.id}`),
		fetch('/api/adapters')
	]);
	if (!pipelineRes.ok) throw error(404, 'Pipeline not found');
	const pipeline = await pipelineRes.json();
	const adapters = adaptersRes.ok ? await adaptersRes.json() : [];
	return { pipeline, adapters };
};
