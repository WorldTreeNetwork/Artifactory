import { AdapterRegistry } from './registry';
import { manualUploadAdapter } from './manual-upload';

export const adapterRegistry = new AdapterRegistry();
adapterRegistry.register(manualUploadAdapter);

export * from './types';
export { AdapterRegistry } from './registry';
