import type { InferSelectModel } from 'drizzle-orm';
import type { assets, pipelineRuns } from '../db/schema';
import type { StorageService } from '../storage';

export type AdapterCategory = 'source' | 'generator' | 'transformer' | 'analyzer' | 'sink';

export interface PortDefinition {
	name: string;
	description: string;
	mimeTypes: string[];
	required: boolean;
}

export interface LogEntry {
	level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	timestamp: number;
	data?: unknown;
}

export interface RunLogger {
	debug(message: string, data?: unknown): void;
	info(message: string, data?: unknown): void;
	warn(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
	getEntries(): LogEntry[];
}

export type AssetRow = InferSelectModel<typeof assets>;
export type PipelineRunRow = InferSelectModel<typeof pipelineRuns>;

export interface ExecutionContext {
	inputs: Record<string, AssetRow>;
	config: Record<string, unknown>;
	run: PipelineRunRow;
	storage: StorageService;
	logger: RunLogger;
}

export interface AdapterResult {
	outputs: Record<string, AssetRow>;
	logs: LogEntry[];
	durationMs: number;
}

export interface Adapter {
	id: string;
	name: string;
	description: string;
	category: AdapterCategory;
	inputPorts: PortDefinition[];
	outputPorts: PortDefinition[];
	configSchema: Record<string, unknown>;
	execute(ctx: ExecutionContext): Promise<AdapterResult>;
}
