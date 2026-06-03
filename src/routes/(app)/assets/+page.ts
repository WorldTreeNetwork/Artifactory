import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/assets');
	if (!res.ok) return { assets: [] };
	const assets = await res.json();
	return { assets };
};
