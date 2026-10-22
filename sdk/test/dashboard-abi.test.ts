import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import { agentTabAbi } from "../src/abi.ts";
import { formatTpot as formatTpotSdk } from "../src/tpot.ts";
import {
  NEXT_ID_SELECTOR,
  OPENED_TOPIC,
  RECORDED_TXS,
  SETTLED_TOPIC,
  decodeTab,
  decodeUint256,
  formatTpot,
  isLoopbackUrl,
  listedIds,
  parseOpenedLog,
  parseSettledLog,
  remainingCalldata,
  tabsCalldata,
} from "../../dashboard/chain.js";

function eventTopic(name: "Opened" | "Settled"): `0x${string}` {
  const event = agentTabAbi.find((item) => item.type === "event" && item.name === name);
  if (!event || event.type !== "event") throw new Error(`missing ${name}`);
  const sig = `${name}(${event.inputs.map((input) => input.type).join(",")})`;
  return keccak256(toBytes(sig));
}

test("dashboard calldata matches agentTabAbi and the public nextId getter", () => {
  assert.equal(tabsCalldata(1n), encodeFunctionData({ abi: agentTabAbi, functionName: "tabs", args: [1n] }));
  assert.equal(remainingCalldata(2n), encodeFunctionData({ abi: agentTabAbi, functionName: "remaining", args: [2n] }));
  assert.equal(NEXT_ID_SELECTOR, keccak256(toBytes("nextId()")).slice(0, 10));
  assert.equal(OPENED_TOPIC, eventTopic("Opened"));
  assert.equal(SETTLED_TOPIC, eventTopic("Settled"));
});

test("formatTpot matches the SDK helper", () => {
  for (const wei of [0n, 10n ** 14n, 5n * 10n ** 15n, 10n ** 16n, 9_900_000_000_000_000n]) {
    assert.equal(formatTpot(wei), formatTpotSdk(wei));
  }
});

test("decodeTab reads a captured tabs() word and rejects an unopened id", () => {
  // Captured eth_call of tabs(1) on 2026-10-22. This checks the decoder, not the live balance.
  const captured =
    "0x0000000000000000000000009e2e2024c7dca86e57608e2cead160081c381fdd" +
    "0000000000000000000000007f220d4db849e7ee220f9f8fdd99fc016b3f3369" +
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "000000000000000000000000000000000000000000000000002386f26fc10000" +
    "0000000000000000000000000000000000000000000000000011c37937e08000" +
    "000000000000000000000000000000000000000000000000000000006ada25b0";
  const tab = decodeTab(captured);
  assert.ok(tab);
  assert.equal(tab.payer, "0x9e2e2024c7dca86e57608e2cead160081c381fdd");
  assert.equal(tab.provider, "0x7f220d4db849e7ee220f9f8fdd99fc016b3f3369");
  assert.equal(tab.token, "0x0000000000000000000000000000000000000000");
  assert.equal(tab.deposit, 10_000_000_000_000_000n);
  assert.equal(tab.claimed, 5_000_000_000_000_000n);
  assert.equal(tab.expiry, 1_792_681_392n);
  assert.equal(decodeTab(`0x${"0".repeat(64 * 6)}`), null);
  assert.equal(decodeUint256("0x0000000000000000000000000000000000000000000000000011c37937e08000"), 5_000_000_000_000_000n);
});

test("log decoders read captured Opened and Settled payloads", () => {
  const opened = parseOpenedLog({
    topics: [
      OPENED_TOPIC,
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x0000000000000000000000009e2e2024c7dca86e57608e2cead160081c381fdd",
      "0x0000000000000000000000007f220d4db849e7ee220f9f8fdd99fc016b3f3369",
    ],
    data:
      "0x0000000000000000000000000000000000000000000000000000000000000000" +
      "000000000000000000000000000000000000000000000000002386f26fc10000" +
      "000000000000000000000000000000000000000000000000000000006ada25b0",
    transactionHash: "0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e",
    blockNumber: "0x23b86",
  });
  assert.equal(opened.id, 1n);
  assert.equal(opened.amount, 10_000_000_000_000_000n);
  assert.equal(opened.transactionHash, "0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e");

  const settled = parseSettledLog({
    topics: [SETTLED_TOPIC, "0x0000000000000000000000000000000000000000000000000000000000000002"],
    data:
      "0x00000000000000000000000000000000000000000000000000005af3107a4000" +
      "00000000000000000000000000000000000000000000000000005af3107a4000",
    transactionHash: "0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99",
    blockNumber: "0x244ab",
  });
  assert.equal(settled.id, 2n);
  assert.equal(settled.paid, 100_000_000_000_000n);
  assert.equal(settled.cumulative, 100_000_000_000_000n);
});

test("recorded hashes are the ones checked into the deployment files", () => {
  const deployment = JSON.parse(readFileSync(new URL("../../deployments/portaldot-testnet.json", import.meta.url), "utf8"));
  const live = JSON.parse(readFileSync(new URL("../../runs/gateway-sdk-live-20261023.json", import.meta.url), "utf8"));
  const hashes = new Set(RECORDED_TXS.map((row) => row.hash.toLowerCase()));
  for (const hash of [
    deployment.contracts.AgentTab.deployTx,
    deployment.demo.txs.fundProvider,
    deployment.demo.txs.open,
    deployment.demo.txs.settle,
    live.openTx,
    live.settleTx,
  ]) {
    assert.equal(hashes.has(String(hash).toLowerCase()), true, hash);
  }
});

test("the list window follows nextId and the probe stays on loopback", () => {
  assert.deepEqual(listedIds(1n), []);
  assert.deepEqual(listedIds(3n).map(String), ["1", "2"]);
  assert.equal(listedIds(50n)[0], 10n);
  assert.equal(isLoopbackUrl("http://127.0.0.1:8402/quote"), true);
  assert.equal(isLoopbackUrl("http://localhost:8402/quote"), true);
  assert.equal(isLoopbackUrl("https://test-evm-rpc-v3.portaldot.dev"), false);
});
