import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/adapters');
	if (!res.ok) return { adapters: [] };
	const adapters = await res.json();
	return { adapters };
};
