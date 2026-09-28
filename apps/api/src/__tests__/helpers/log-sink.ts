import { Writable } from "node:stream";

export interface LogSink {
  /** Raw JSON lines, in the order pino emitted them. */
  lines: string[];
  /** The same lines parsed, for assertions that care about fields. */
  entries(): Array<Record<string, unknown>>;
  /** The first entry matching the predicate, or undefined. */
  find(predicate: (entry: Record<string, unknown>) => boolean): Record<string, unknown> | undefined;
  /** A pino destination that writes into this sink. */
  stream: Writable;
}

/**
 * A log destination that keeps every line so a test can assert on what was written.
 *
 * `writeSync` is the important part: pino only writes synchronously when the
 * destination exposes it, and otherwise flushes on a later tick -- at which point an
 * assertion that runs immediately after the log call sees an empty sink.
 */
export function logSink(): LogSink {
  const lines: string[] = [];
  const push = (chunk: string | Uint8Array) => {
    lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
  };

  const stream = new Writable({
    write(chunk, _encoding, done) {
      push(chunk as Uint8Array);
      done();
    },
  }) as Writable & { writeSync: (chunk: string | Uint8Array) => boolean };
  stream.writeSync = (chunk) => {
    push(chunk);
    return true;
  };

  return {
    lines,
    stream,
    entries: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
    find: (predicate) => lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find(predicate),
  };
}
