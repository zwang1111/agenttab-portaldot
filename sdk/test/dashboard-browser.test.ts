import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("dashboard/browser.js is the classic bundle of chain.js and app.js", () => {
  const check = spawnSync(process.execPath, ["scripts/build-dashboard-browser.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const committed = readFileSync(join(root, "dashboard/browser.js"), "utf8");
  assert.equal(committed.includes("export "), false);
  assert.equal(committed.includes('from "./chain.js"'), false);
  assert.equal(/^\s*import\s/m.test(committed), false);
  assert.match(committed, /0x9a096C216f79e08C2DB95d92F412697D8F1f9329/);
  assert.match(committed, /0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886/);
});

test("dashboard/index.html loads the classic bundle, not a module", () => {
  const html = readFileSync(join(root, "dashboard/index.html"), "utf8");
  assert.match(html, /<script src="\.\/browser\.js"><\/script>/);
  assert.equal(html.includes('type="module"'), false);
  assert.match(html, /href="\.\/styles\.css"/);
});
