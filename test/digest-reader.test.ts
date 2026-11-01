import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

const fixtureRuns = fileURLToPath(new URL('../runs/', import.meta.url));
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRuns(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tempDirs.push(dir);
  return dir;
}

describe('readNight', () => {
  it('aggregates the fixture, counts its bad line, and preserves missing owners and offsets', () => {
    const digest = readNight(fixtureRuns, '2026-10-28');
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest?.rows.find((row) => row.job === 'digest/render')?.owner).toBeNull();
    expect(digest?.rows.find((row) => row.job === 'fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows.find((row) => row.job === 'notes/backup')).toMatchObject({
      runs: 1,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('returns null for missing and unsafe names, and no rows for an empty file', () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-10-30.jsonl'), '');
    expect(readNight(dir, '2026-10-29')).toBeNull();
    expect(readNight(dir, '../secrets')).toBeNull();
    expect(readNight(dir, '2026-10-30')).toEqual({
      night: '2026-10-30',
      rows: [],
      badLines: 0,
    });
  });

  it('ignores invalid events and uses event times for the first and last run', () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-10-30.jsonl'), [
      '{"at":"2026-10-30T10:00:00+02:00","job":"a","status":"ok","owner":"new"}',
      '{"at":"2026-10-30T08:30:00+01:00","job":"a","status":"retry","owner":"old","error":"blocked"}',
      '{"at":"2026-10-30T08:00:00+01:00","job":"a","status":"retry","owner":"earlier","error":"stale"}',
      '{"job":"a","status":"ok","owner":"bad"}',
      '{"at":"2026-10-30T11:00:00+01:00","job":"a","status":"unknown","owner":"bad"}',
    ].join('\n'));

    expect(readNight(dir, '2026-10-30')).toEqual({
      night: '2026-10-30',
      rows: [{
        job: 'a',
        owner: 'new',
        runs: 3,
        retries: 2,
        lastStatus: 'ok',
        lastError: 'blocked',
        firstAt: '2026-10-30T08:00:00+01:00',
        lastAt: '2026-10-30T10:00:00+02:00',
      }],
      badLines: 2,
    });
  });
});
