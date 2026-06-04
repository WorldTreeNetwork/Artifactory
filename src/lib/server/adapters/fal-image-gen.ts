import { fal } from '@fal-ai/client';
import type { Adapter } from './types';

// Configure fal client from environment
fal.config({
	credentials: process.env.FAL_KEY ?? ''
});

export const falImageGenAdapter: Adapter = {
	id: 'fal-image-gen',
	name: 'Image Generator (fal.ai)',
	description:
		'Generate images from text prompts using fal.ai FLUX models. Supports multiple sizes and output formats.',
	category: 'generator',
	inputPorts: [
		{
			name: 'prompt',
			description: 'Text description of the desired image',
			mimeTypes: ['text/plain'],
			required: true,
			schema: {
				type: 'object',
				properties: {
					content: { type: 'string', description: 'The text prompt' }
				}
			}
		}
	],
	outputPorts: [
		{
			name: 'image',
			description: 'Generated image',
			mimeTypes: ['image/jpeg', 'image/png'],
			required: true,
			schema: {
				type: 'object',
				properties: {
					url: { type: 'string', description: 'URL of the generated image' },
					content_type: { type: 'string', description: 'MIME type of the image' },
					width: { type: 'number', description: 'Image width in pixels' },
					height: { type: 'number', description: 'Image height in pixels' },
					seed: { type: 'number', description: 'Seed used for generation' },
					prompt: { type: 'string', description: 'The prompt used' }
				}
			}
		}
	],
	configSchema: {
		type: 'object',
		properties: {
			model: {
				type: 'string',
				description: 'fal.ai model endpoint',
				default: 'fal-ai/flux/schnell'
			},
			image_size: {
				type: 'string',
				enum: [
					'square_hd',
					'square',
					'portrait_4_3',
					'portrait_16_9',
					'landscape_4_3',
					'landscape_16_9'
				],
				default: 'landscape_4_3',
				description: 'Output image size preset'
			},
			num_inference_steps: {
				type: 'number',
				default: 4,
				description: 'Number of inference steps (1-12)'
			},
			guidance_scale: {
				type: 'number',
				default: 3.5,
				description: 'How closely to follow the prompt (1-20)'
			},
			output_format: {
				type: 'string',
				enum: ['jpeg', 'png'],
				default: 'jpeg',
				description: 'Output image format'
			},
			seed: {
				type: 'number',
				description: 'Seed for reproducible results (optional)'
			}
		}
	},

	async execute(ctx) {
		const model = (ctx.config.model as string) || 'fal-ai/flux/schnell';

		// Get prompt from input port or config
		let prompt: string;
		const promptInput = ctx.inputs.prompt;
		if (promptInput?.content) {
			prompt = promptInput.content;
		} else if (ctx.config.prompt) {
			prompt = ctx.config.prompt as string;
		} else {
			throw new Error('No prompt provided. Connect a text asset to the prompt input or set prompt in config.');
		}

		ctx.logger.info(`Generating image with ${model}`, { prompt: prompt.slice(0, 100) });

		const input: Record<string, unknown> = {
			prompt,
			image_size: ctx.config.image_size ?? 'landscape_4_3',
			num_inference_steps: ctx.config.num_inference_steps ?? 4,
			guidance_scale: ctx.config.guidance_scale ?? 3.5,
			output_format: ctx.config.output_format ?? 'jpeg',
			num_images: 1,
			enable_safety_checker: true
		};

		if (ctx.config.seed !== undefined) {
			input.seed = ctx.config.seed;
		}

		const startTime = Date.now();

		const result = await fal.subscribe(model, {
			input,
			logs: true,
			onQueueUpdate(update) {
				if (update.status === 'IN_QUEUE') {
					ctx.logger.info(`Queued — position ${update.queue_position ?? '?'}`);
				} else if (update.status === 'IN_PROGRESS') {
					ctx.logger.info('Generating...');
				}
			}
		});

		const durationMs = Date.now() - startTime;
		const data = result.data as {
			images: Array<{ url: string; content_type: string; width?: number; height?: number }>;
			seed: number;
			prompt: string;
		};

		if (!data.images || data.images.length === 0) {
			throw new Error('No images returned from fal.ai');
		}

		const image = data.images[0];
		ctx.logger.info(`Image generated in ${durationMs}ms`, {
			url: image.url,
			seed: data.seed
		});

		// Download the image and store it
		const imageResponse = await fetch(image.url);
		if (!imageResponse.ok) {
			throw new Error(`Failed to download generated image: ${imageResponse.status}`);
		}

		const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
		const mimeType = image.content_type || `image/${ctx.config.output_format ?? 'jpeg'}`;
		const ext = mimeType === 'image/png' ? 'png' : 'jpg';

		// Store the image
		const assetId = crypto.randomUUID();
		const storageKey = `${assetId}/generated.${ext}`;
		await ctx.storage.put(storageKey, imageBuffer);

		// Import db and assets table for creating the asset record
		const { db } = await import('../db');
		const { assets } = await import('../db/schema');

		const [asset] = await db
			.insert(assets)
			.values({
				id: assetId,
				mimeType,
				metadata: {
					seed: data.seed,
					prompt: data.prompt || prompt,
					model,
					width: image.width,
					height: image.height,
					fal_url: image.url
				},
				storageKey,
				size: imageBuffer.length,
				pipelineRunId: ctx.run.id,
				sourceNodeId: undefined,
				sourceNodeRunId: undefined
			})
			.returning();

		return {
			outputs: { image: asset },
			logs: ctx.logger.getEntries(),
			durationMs
		};
	}
};
