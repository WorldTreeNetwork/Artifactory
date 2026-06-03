import { Elysia, t } from 'elysia';
import { status } from 'elysia/error';
import { eq, and, like } from 'drizzle-orm';
import { db } from '../../db';
import { assets } from '../../db/schema';
import { storage } from '../../storage';

export const assetRoutes = new Elysia({ prefix: '/assets' })
	.get(
		'/',
		async ({ query }) => {
			const conditions = [];
			if (query.mimeType) conditions.push(like(assets.mimeType, `${query.mimeType}%`));
			if (query.pipelineRunId) conditions.push(eq(assets.pipelineRunId, query.pipelineRunId));

			const where = conditions.length > 0 ? and(...conditions) : undefined;
			const limit = query.limit ?? 50;
			const offset = query.offset ?? 0;

			const rows = await db.select().from(assets).where(where).limit(limit).offset(offset).all();

			return rows;
		},
		{
			query: t.Object({
				mimeType: t.Optional(t.String()),
				pipelineRunId: t.Optional(t.String()),
				limit: t.Optional(t.Number()),
				offset: t.Optional(t.Number())
			})
		}
	)
	.get(
		'/:id',
		async ({ params }) => {
			const asset = await db.select().from(assets).where(eq(assets.id, params.id)).get();
			if (!asset) return status(404, { message: 'Asset not found' });
			return asset;
		},
		{ params: t.Object({ id: t.String() }) }
	)
	.post(
		'/',
		async ({ body }) => {
			const id = crypto.randomUUID();
			let storageKey: string | null = null;

			if (body.file) {
				const bytes = new Uint8Array(await body.file.arrayBuffer());
				storageKey = `${id}/${body.file.name}`;
				await storage.put(storageKey, Buffer.from(bytes));
			}

			const [asset] = await db
				.insert(assets)
				.values({
					id,
					mimeType: body.file?.type ?? body.mimeType ?? 'text/plain',
					metadata: body.metadata ? JSON.parse(body.metadata) : {},
					storageKey,
					size: body.file?.size ?? body.content?.length ?? 0,
					content: body.content ?? null
				})
				.returning();

			return asset;
		},
		{
			body: t.Object({
				file: t.Optional(t.File()),
				mimeType: t.Optional(t.String()),
				content: t.Optional(t.String()),
				metadata: t.Optional(t.String())
			})
		}
	)
	.delete(
		'/:id',
		async ({ params }) => {
			const asset = await db.select().from(assets).where(eq(assets.id, params.id)).get();
			if (!asset) return status(404, { message: 'Asset not found' });

			if (asset.storageKey) {
				await storage.delete(asset.storageKey);
			}

			await db.delete(assets).where(eq(assets.id, params.id));
			return { success: true };
		},
		{ params: t.Object({ id: t.String() }) }
	);
