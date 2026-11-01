export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  night: string;
  // The reader returns rows sorted by job so HTML and JSON share one order.
  rows: DigestRow[];
  badLines: number;
};

// A missing file returns null; an empty file returns a digest with no rows.
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
