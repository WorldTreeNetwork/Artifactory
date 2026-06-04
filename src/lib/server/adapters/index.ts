import { AdapterRegistry } from './registry';
import { manualUploadAdapter } from './manual-upload';
import { falImageGenAdapter } from './fal-image-gen';

export const adapterRegistry = new AdapterRegistry();
adapterRegistry.register(manualUploadAdapter);
adapterRegistry.register(falImageGenAdapter);

export * from './types';
export { AdapterRegistry } from './registry';
