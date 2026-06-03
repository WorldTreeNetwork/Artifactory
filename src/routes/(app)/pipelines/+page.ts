export const load = async ({ fetch }) => {
	const res = await fetch('/api/pipelines');
	const pipelines = res.ok ? await res.json() : [];
	return { pipelines };
};
