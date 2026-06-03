import type { Adapter, AdapterCategory } from './types';

export class AdapterRegistry {
	private adapters = new Map<string, Adapter>();

	register(adapter: Adapter): void {
		if (this.adapters.has(adapter.id)) {
			throw new Error(`Adapter "${adapter.id}" is already registered`);
		}
		this.adapters.set(adapter.id, adapter);
	}

	get(id: string): Adapter | undefined {
		return this.adapters.get(id);
	}

	getOrThrow(id: string): Adapter {
		const adapter = this.adapters.get(id);
		if (!adapter) throw new Error(`Adapter "${id}" not found`);
		return adapter;
	}

	list(): Adapter[] {
		return [...this.adapters.values()];
	}

	listByCategory(category: AdapterCategory): Adapter[] {
		return this.list().filter((a) => a.category === category);
	}
}
