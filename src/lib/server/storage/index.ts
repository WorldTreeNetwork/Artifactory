import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface StorageService {
	put(key: string, data: Buffer | Uint8Array): Promise<void>;
	get(key: string): Promise<Buffer>;
	delete(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	getUrl(key: string): string;
}

export class LocalStorageService implements StorageService {
	constructor(private basePath: string = './storage') {}

	private resolvePath(key: string): string {
		return join(this.basePath, key);
	}

	async put(key: string, data: Buffer | Uint8Array): Promise<void> {
		const filePath = this.resolvePath(key);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, data);
	}

	async get(key: string): Promise<Buffer> {
		return readFile(this.resolvePath(key));
	}

	async delete(key: string): Promise<void> {
		try {
			await unlink(this.resolvePath(key));
		} catch (e: unknown) {
			if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			await access(this.resolvePath(key));
			return true;
		} catch {
			return false;
		}
	}

	getUrl(key: string): string {
		return `/api/storage/${key}`;
	}
}

export const storage = new LocalStorageService(process.env.STORAGE_PATH ?? './storage');
