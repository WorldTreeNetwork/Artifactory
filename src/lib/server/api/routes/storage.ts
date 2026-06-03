import { Elysia } from 'elysia';
import { status } from 'elysia/error';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { assets } from '../../db/schema';
import { storage } from '../../storage';

export const storageRoutes = new Elysia({ prefix: '/storage' }).get('/*', async ({ params }) => {
	const key = (params as Record<string, string>)['*'];
	if (!key) return status(400, { message: 'Missing storage key' });

	const exists = await storage.exists(key);
	if (!exists) return status(404, { message: 'File not found' });

	const asset = await db.select().from(assets).where(eq(assets.storageKey, key)).get();

	const data = await storage.get(key);
	return new Response(new Uint8Array(data), {
		headers: {
			'Content-Type': asset?.mimeType ?? 'application/octet-stream',
			'Content-Length': data.length.toString()
		}
	});
});
