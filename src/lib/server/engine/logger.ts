import type { RunLogger, LogEntry } from '../adapters/types';

export class NodeRunLogger implements RunLogger {
	private entries: LogEntry[] = [];

	debug(message: string, data?: unknown): void {
		this.push('debug', message, data);
	}

	info(message: string, data?: unknown): void {
		this.push('info', message, data);
	}

	warn(message: string, data?: unknown): void {
		this.push('warn', message, data);
	}

	error(message: string, data?: unknown): void {
		this.push('error', message, data);
	}

	getEntries(): LogEntry[] {
		return [...this.entries];
	}

	private push(level: LogEntry['level'], message: string, data?: unknown): void {
		this.entries.push({ level, message, timestamp: Date.now(), data });
	}
}
