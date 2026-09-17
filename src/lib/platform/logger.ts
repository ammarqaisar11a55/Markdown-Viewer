import { isTauri } from '@tauri-apps/api/core';
import * as tauriLog from '@tauri-apps/plugin-log';

type Level = 'debug' | 'info' | 'warn' | 'error';

const CONSOLE: Record<Level, (...data: unknown[]) => void> = {
  debug: (...data) => {
    console.debug(...data);
  },
  info: (...data) => {
    console.info(...data);
  },
  warn: (...data) => {
    console.warn(...data);
  },
  error: (...data) => {
    console.error(...data);
  },
};

function describe(detail: unknown): string {
  if (detail === undefined) return '';
  if (detail instanceof Error) return detail.stack ?? `${detail.name}: ${detail.message}`;
  if (typeof detail === 'string') return detail;
  try {
    const json = JSON.stringify(detail) as unknown;
    return typeof json === 'string' ? json : typeof detail;
  } catch {
    return typeof detail;
  }
}

function write(level: Level, message: string, detail?: unknown): void {
  const text = detail === undefined ? message : `${message} — ${describe(detail)}`;
  if (isTauri()) {
    tauriLog[level](text).catch(() => undefined);
    return;
  }
  const log = CONSOLE[level];
  if (detail === undefined) log(`[mdv] ${message}`);
  else log(`[mdv] ${message}`, detail);
}

export const logger = {
  debug: (message: string, detail?: unknown) => {
    write('debug', message, detail);
  },
  info: (message: string, detail?: unknown) => {
    write('info', message, detail);
  },
  warn: (message: string, detail?: unknown) => {
    write('warn', message, detail);
  },
  error: (message: string, detail?: unknown) => {
    write('error', message, detail);
  },
};
