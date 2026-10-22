import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PLANCK_PER_TPOT,
  WEI_PER_PLANCK,
  WEI_PER_TPOT,
  formatTpot,
  parseTpot,
  planckToWei,
  weiToPlanck,
} from "../src/index.ts";

test("1 tPOT is 10^18 wei and 10^14 substrate planck", () => {
  assert.equal(parseTpot("1"), WEI_PER_TPOT);
  assert.equal(planckToWei(PLANCK_PER_TPOT), WEI_PER_TPOT);
  assert.equal(weiToPlanck(WEI_PER_TPOT), PLANCK_PER_TPOT);
  assert.equal(WEI_PER_PLANCK, 10_000n);
});

test("demo deposit 0.01 tPOT is 1e16 wei and planck-aligned", () => {
  const wei = parseTpot("0.01");
  assert.equal(wei, 10n ** 16n);
  assert.equal(weiToPlanck(wei), 10n ** 12n);
  assert.equal(formatTpot(wei, 8), "0.01");
});

test("default call price 0.0001 tPOT is 1e14 wei", () => {
  const wei = parseTpot("0.0001");
  assert.equal(wei, 10n ** 14n);
  assert.equal(formatTpot(wei, 8), "0.0001");
  assert.equal(weiToPlanck(wei), 10n ** 10n);
});

test("format truncates and parse round-trips an aligned amount", () => {
  const wei = parseTpot("167.488496");
  assert.equal(formatTpot(wei, 6), "167.488496");
  assert.equal(parseTpot(formatTpot(wei, 18)), wei);
});

test("rejects unaligned wei and over-precise decimals", () => {
  assert.throws(() => weiToPlanck(1n), /planck/);
  assert.equal(weiToPlanck(1n, "floor"), 0n);
  assert.throws(() => parseTpot("1.0000000000000000001"), /fractional/);
  assert.throws(() => parseTpot("-1"), /invalid/);
  assert.throws(() => parseTpot("1e18"), /invalid/);
});
