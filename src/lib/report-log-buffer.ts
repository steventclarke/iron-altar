import {
  LOG_MAX_BYTES,
  LOG_MAX_ENTRIES,
  STACK_TRACE_MAX_ENTRIES,
  redactReport,
  type JsonValue,
  type LogEntry,
  type StackTraceEntry,
} from '@stevenclarke/issue-reporter-client';

import { ensureReportCrypto } from '@/lib/report-crypto';

type ConsoleLevel = LogEntry['level'];
type ConsoleMethod = (...args: unknown[]) => void;

type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: Error, isFatal: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal: boolean) => void) => void;
};

const originalConsole: Record<ConsoleLevel, ConsoleMethod> = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let logs: LogEntry[] = [];
let stackTraces: StackTraceEntry[] = [];
let installed = false;

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

const toJsonValue = (value: unknown, depth = 0): JsonValue | undefined => {
  try {
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack ?? '' };
    }
    if (depth >= 4) return '[TRUNCATED]';

    if (Array.isArray(value)) {
      return value.slice(0, 50).map((item) => toJsonValue(item, depth + 1) ?? '[UNSERIALIZABLE]');
    }

    if (typeof value === 'object') {
      const source = value as Record<string, unknown>;
      const result: Record<string, JsonValue> = {};
      for (const key of Object.keys(source).slice(0, 50)) {
        const converted = toJsonValue(source[key], depth + 1);
        if (converted !== undefined) result[key] = converted;
      }
      return result;
    }

    return undefined;
  } catch {
    return undefined;
  }
};

const formatArgs = (args: unknown[]): Pick<LogEntry, 'message' | 'context'> => {
  const parts: string[] = [];
  const context: Record<string, JsonValue> = {};

  args.forEach((arg, index) => {
    if (typeof arg === 'string') {
      parts.push(arg);
      return;
    }

    const converted = toJsonValue(arg);
    if (converted === undefined) {
      parts.push(String(arg));
      return;
    }

    if (
      typeof converted === 'string' ||
      typeof converted === 'number' ||
      typeof converted === 'boolean'
    ) {
      parts.push(String(converted));
      return;
    }

    parts.push(JSON.stringify(converted));
    context[`arg${index}`] = converted;
  });

  return {
    message: parts.join(' '),
    context: Object.keys(context).length > 0 ? context : undefined,
  };
};

const appendLog = (level: ConsoleLevel, args: unknown[]): void => {
  const formatted = formatArgs(args);
  const entry = redactReport<LogEntry>({
    timestamp: new Date().toISOString(),
    level,
    message: formatted.message,
    ...(formatted.context ? { context: formatted.context } : {}),
  });

  logs.push(entry);
  let bytes = logs.reduce((total, item) => total + byteLength(JSON.stringify(item)), 0);
  while (logs.length > LOG_MAX_ENTRIES || bytes > LOG_MAX_BYTES) {
    const removed = logs.shift();
    if (!removed) break;
    bytes -= byteLength(JSON.stringify(removed));
  }
};

const appendStack = (error: unknown, isFatal: boolean): void => {
  const normalized =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown unhandled error');
  const entry = redactReport<StackTraceEntry>({
    timestamp: new Date().toISOString(),
    message: normalized.message,
    stack: normalized.stack ?? '',
    isFatal,
  });

  stackTraces.push(entry);
  if (stackTraces.length > STACK_TRACE_MAX_ENTRIES) stackTraces.shift();
};

export function installReportLogCapture(): void {
  if (installed) return;
  installed = true;
  ensureReportCrypto();

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    appendLog('log', args);
  };
  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    appendLog('info', args);
  };
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    appendLog('warn', args);
  };
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    appendLog('error', args);
  };

  const scope = globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike };
  const previousHandler = scope.ErrorUtils?.getGlobalHandler?.();

  scope.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    if (previousHandler) previousHandler(error, isFatal);
    else originalConsole.error(error);
    appendStack(error, isFatal);
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      appendStack(event.error ?? new Error(event.message), false);
    });
    window.addEventListener('unhandledrejection', (event) => {
      appendStack(event.reason, false);
    });
  }
}

export function getReportLogs(): LogEntry[] {
  return logs.map((entry) => ({
    ...entry,
    ...(entry.context ? { context: { ...entry.context } } : {}),
  }));
}

export function getReportStackTraces(): StackTraceEntry[] {
  return stackTraces.map((entry) => ({ ...entry }));
}
