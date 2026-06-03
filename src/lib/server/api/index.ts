import { Elysia } from 'elysia';
import { assetRoutes } from './routes/assets';
import { storageRoutes } from './routes/storage';
import { pipelineRoutes } from './routes/pipelines';
import { adapterRoutes } from './routes/adapters';
import { runRoutes } from './routes/runs';

export const app = new Elysia({ prefix: '/api' })
	.get('/health', () => ({ status: 'ok' }))
	.use(assetRoutes)
	.use(storageRoutes)
	.use(pipelineRoutes)
	.use(adapterRoutes)
	.use(runRoutes);

export type App = typeof app;
