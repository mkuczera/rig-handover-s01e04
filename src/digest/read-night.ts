import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.at !== 'string' ||
    !Number.isFinite(Date.parse(event.at)) ||
    typeof event.job !== 'string' ||
    event.job.length === 0 ||
    (event.status !== 'ok' && event.status !== 'retry' && event.status !== 'fail') ||
    (typeof event.owner !== 'string' && event.owner !== null) ||
    (event.error !== undefined && typeof event.error !== 'string')
  ) return null;

  return event as RunEvent;
}

export const readNight: ReadNight = (runsDir, night) => {
  // A route parameter must never become a path outside the runs directory.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  const lastErrorAt = new Map<string, number>();
  let badLines = 0;

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const event = parseEvent(line);
    if (event === null) {
      badLines++;
      continue;
    }

    const row = rows.get(event.job);
    if (row === undefined) {
      rows.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      if (event.error !== undefined) lastErrorAt.set(event.job, Date.parse(event.at));
      continue;
    }

    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (Date.parse(event.at) < Date.parse(row.firstAt)) row.firstAt = event.at;
    if (Date.parse(event.at) >= Date.parse(row.lastAt)) {
      row.lastAt = event.at;
      row.lastStatus = event.status;
      row.owner = event.owner;
    }
    if (event.error !== undefined && Date.parse(event.at) >= (lastErrorAt.get(event.job) ?? -Infinity)) {
      row.lastError = event.error;
      lastErrorAt.set(event.job, Date.parse(event.at));
    }
  }

  const digest: DigestNight = {
    night,
    rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)),
    badLines,
  };
  return digest;
};
