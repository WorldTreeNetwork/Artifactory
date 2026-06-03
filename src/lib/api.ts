import { treaty } from '@elysia/eden';
import type { App } from '$lib/server/api';

export const api = treaty<App>(window.location.origin);
