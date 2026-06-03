import { eq } from 'drizzle-orm';
import { db } from '../db';
import { assets } from '../db/schema';
import type { Adapter } from './types';

export const manualUploadAdapter: Adapter = {
	id: 'manual-upload',
	name: 'Manual Upload',
	description:
		'A source node for user-uploaded assets. Attach an asset before running the pipeline.',
	category: 'source',
	inputPorts: [],
	outputPorts: [
		{
			name: 'output',
			description: 'The uploaded asset',
			mimeTypes: ['*/*'],
			required: true,
			schema: {
				type: 'object',
				properties: {
					id: { type: 'string', description: 'Asset ID' },
					mimeType: { type: 'string', description: 'MIME type of the asset' },
					size: { type: 'number', description: 'File size in bytes' },
					storageKey: { type: 'string', description: 'Storage location key' },
					content: { type: 'string', description: 'Inline text content (if text asset)' }
				}
			}
		}
	],
	configSchema: {
		type: 'object',
		properties: {
			assetId: { type: 'string', description: 'ID of the pre-uploaded asset' },
			acceptedMimeTypes: {
				type: 'array',
				items: { type: 'string' },
				default: ['*/*']
			}
		},
		required: ['assetId']
	},

	async execute(ctx) {
		const assetId = ctx.config.assetId as string;
		if (!assetId) throw new Error('manual-upload requires config.assetId');

		const asset = await db.select().from(assets).where(eq(assets.id, assetId)).get();
		if (!asset) throw new Error(`Asset "${assetId}" not found`);

		ctx.logger.info(`Loaded asset ${assetId} (${asset.mimeType}, ${asset.size} bytes)`);

		return {
			outputs: { output: asset },
			logs: ctx.logger.getEntries(),
			durationMs: 0
		};
	}
};
