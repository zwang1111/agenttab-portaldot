import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFunctionData, getAddress, zeroAddress } from "viem";
import { AGENT_TAB_PORTALDOT_TESTNET, NATIVE, agentTabAbi, buildOpenNativeTab, buildSettle, parseTpot } from "../src/index.ts";

const provider = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

test("open calldata is a payable native tab: token address(0) and value = deposit", () => {
  const depositWei = parseTpot("0.01");
  const expiry = 1_792_681_392n;
  const call = buildOpenNativeTab({ provider, depositWei, expiry });
  assert.equal(call.to, AGENT_TAB_PORTALDOT_TESTNET);
  assert.equal(call.value, depositWei);
  assert.equal(call.token, NATIVE);
  const decoded = decodeFunctionData({ abi: agentTabAbi, data: call.data });
  assert.equal(decoded.functionName, "open");
  assert.deepEqual(decoded.args, [provider, zeroAddress, depositWei, expiry]);
});

test("open rejects a deposit that is not an integer number of planck", () => {
  assert.throws(() => buildOpenNativeTab({ provider, depositWei: 1n, expiry: 10n }), /planck/);
});

test("settle calldata carries the cumulative voucher", () => {
  const signature = `0x${"ab".repeat(32)}${"11".repeat(32)}1b` as const;
  const call = buildSettle({ tabId: 1n, cumulative: parseTpot("0.0001"), signature });
  const decoded = decodeFunctionData({ abi: agentTabAbi, data: call.data });
  assert.equal(decoded.functionName, "settle");
  assert.equal(call.value, 0n);
  assert.equal(decoded.args[0], 1n);
  assert.equal(decoded.args[1], parseTpot("0.0001"));
  assert.equal(decoded.args[2], signature);
});
