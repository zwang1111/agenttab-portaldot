import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFunctionData, zeroAddress } from "viem";
import { agentTabAbi, assetsErc20Precompile, buildOpenErc20Tab, DEMO_PROVIDER } from "../src/index.ts";

test("Assets precompile address is asset id in the first four bytes and prefix 0x0001", () => {
  assert.equal(assetsErc20Precompile(2), "0x0000000200000000000000000000000000010000");
  assert.equal(assetsErc20Precompile(4242), "0x0000109200000000000000000000000000010000");
  assert.equal(assetsErc20Precompile(806707).toLowerCase(), "0x000c4f3300000000000000000000000000010000");
});

test("PoolAssets uses the same layout with prefix 0x0002", () => {
  assert.equal(assetsErc20Precompile(0, 0x0002), "0x0000000000000000000000000000000000020000");
  assert.equal(assetsErc20Precompile(1, 0x0002), "0x0000000100000000000000000000000000020000");
});

test("rejects an asset id that does not fit in uint32", () => {
  assert.throws(() => assetsErc20Precompile(-1), /uint32/);
  assert.throws(() => assetsErc20Precompile(0x1_0000_0000n), /uint32/);
  assert.throws(() => assetsErc20Precompile(1, 0), /prefix/);
});

test("ERC-20 open calldata targets the precompile and sends no native value", () => {
  const call = buildOpenErc20Tab({
    provider: DEMO_PROVIDER,
    assetId: 2,
    amount: 1n,
    expiry: 1_893_456_000n,
  });
  assert.equal(call.value, 0n);
  assert.equal(call.token, "0x0000000200000000000000000000000000010000");
  assert.notEqual(call.token, zeroAddress);
  const decoded = decodeFunctionData({ abi: agentTabAbi, data: call.data });
  assert.equal(decoded.functionName, "open");
  assert.deepEqual(decoded.args, [
    DEMO_PROVIDER,
    "0x0000000200000000000000000000000000010000",
    1n,
    1_893_456_000n,
  ]);
});
