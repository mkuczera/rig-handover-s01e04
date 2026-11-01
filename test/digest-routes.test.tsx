import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const night = '2026-10-30';
const tempDirs: string[] = [];

function testApp(lines?: string) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(runsDir);
  if (lines !== undefined) writeFileSync(join(runsDir, `${night}.jsonl`), lines);
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function jobsInPage(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>/g)].map((match) => match[1]);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('renders a page and JSON with the same rows in job order', async () => {
    const app = testApp([
      JSON.stringify({ at: '2026-10-30T08:02:00+01:00', job: 'zeta', status: 'fail', owner: 'Mira', error: 'blocked' }),
      JSON.stringify({ at: '2026-10-30T08:01:00+01:00', job: 'alpha', status: 'retry', owner: null }),
    ].join('\n'));

    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await page.text();
    const rows = await json.json() as DigestRow[];

    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(json.status).toBe(200);
    expect(json.headers.get('content-type')).toContain('application/json');
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(jobsInPage(html)).toEqual(rows.map((row) => row.job));
    expect(rows[0]).toMatchObject({ owner: null, runs: 1, retries: 1, lastStatus: 'retry' });
    expect(html).toContain('>—</td>');
    expect(html).toContain('blocked');
  });

  it('returns 404 from both routes when the night has no file', async () => {
    const app = testApp();
    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('shows the empty state and returns an empty JSON array for an empty night', async () => {
    const app = testApp('');
    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([]);
  });

  it('skips a bad line without hiding the valid job', async () => {
    const app = testApp([
      '{bad json',
      JSON.stringify({ at: '2026-10-30T08:00:00+01:00', job: 'still-ran', status: 'ok', owner: 'Mira' }),
    ].join('\n'));
    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await page.text();
    const rows = await json.json() as DigestRow[];

    expect(page.status).toBe(200);
    expect(html).toContain('1 malformed line skipped');
    expect(jobsInPage(html)).toEqual(['still-ran']);
    expect(json.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['still-ran']);
  });
});
