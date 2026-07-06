import type { LogEntry } from '../types';

const LOG_KEY = 'marking_logs';

export function saveSessionLog(entry: Omit<LogEntry, 'ts'>) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const logs: LogEntry[] = raw ? JSON.parse(raw) : [];
    logs.unshift({ ts: Date.now(), ...entry });
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function getSessionLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSessionLogs() {
  localStorage.removeItem(LOG_KEY);
}
