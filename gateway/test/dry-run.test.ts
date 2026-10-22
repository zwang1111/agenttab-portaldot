import assert from "node:assert/strict";
import { test } from "node:test";
import { runDryRun } from "../src/dry-run.ts";

test("dry-run script proves 402, one paid call, and replay rejection", async () => {
  const lines: string[] = [];
  await runDryRun((line) => lines.push(line));
  assert.match(lines.join("\n"), /402 0\.0001 tPOT\s+chain 420420777/);
  assert.match(lines.join("\n"), /200 tab 1/);
  assert.match(lines.join("\n"), /402 replay stale/);
  assert.equal(lines.at(-1), "dry-run ok");
});
