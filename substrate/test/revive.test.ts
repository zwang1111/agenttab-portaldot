import assert from "node:assert/strict";
import { test } from "node:test";
import { keccak256, toBytes } from "viem";
import { bytesToHex, encodeCompact, hexToBytes, twox128 } from "../src/scale.ts";
import { ss58Encode } from "../src/ss58.ts";
import {
  assetStorageKey,
  decodeAssetSupply,
  decodeReviveDust,
  reviveAccountInfoKey,
} from "../src/storage.ts";
import {
  accountIdToH160,
  decodeReviveApiCall,
  deployerFallbackAccountId,
  encodeRemaining,
  encodeReviveApiCall,
  encodeReviveCall,
  errorSelector,
  evmBalanceFromFree,
  h160ToFallbackAccountId,
} from "../src/revive.ts";

const PROBE_ACCOUNT = hexToBytes("3aa4f3167bda89e0c95ffbb5e7a389a83e21bd549a525dbc795f727508347e22");

test("sr25519 account hashes to the last 20 bytes of keccak256", () => {
  assert.equal(accountIdToH160(PROBE_ACCOUNT), "0xad22e1df6ed2962eb93ef88434a99a26ab643a73");
  assert.equal(ss58Encode(PROBE_ACCOUNT), "5DPbdmUjtozfZrbEQL5zJAc9W46CK2PjkZKWLBN5SVwi3fRp");
});

test("eth-derived fallback is the H160 followed by twelve 0xEE bytes", () => {
  const account = deployerFallbackAccountId();
  assert.equal(
    bytesToHex(account),
    "0x9e2e2024c7dca86e57608e2cead160081c381fddeeeeeeeeeeeeeeeeeeeeeeee",
  );
  assert.equal(ss58Encode(account), "5Fe78D5g5NcrMU2J97UXdQEMU1DSNwgh7knaHirpD8J8th3U");
  assert.equal(accountIdToH160(account), "0x9e2e2024c7dca86e57608e2cead160081c381fdd");
  assert.deepEqual(h160ToFallbackAccountId("0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd"), account);
});

test("EVM balance is (free - 0.1 tPOT) * 10000 + revive dust", () => {
  const free = 15215275935089184n;
  const dust = 4660n;
  assert.equal(evmBalanceFromFree(free, dust), 152052759350891844660n);
});

test("ReviveApi_call codec matches a spec-3002 dry-run of remaining(1)", () => {
  const params = encodeReviveApiCall({
    origin: PROBE_ACCOUNT,
    dest: "0x9a096C216f79e08C2DB95d92F412697D8F1f9329",
    data: encodeRemaining(1n),
  });
  assert.equal(
    bytesToHex(params),
    "0x3aa4f3167bda89e0c95ffbb5e7a389a83e21bd549a525dbc795f727508347e229a096c216f79e08c2db95d92f412697d8f1f9329000000000000000000000000000000000000900361bf140000000000000000000000000000000000000000000000000000000000000001",
  );
  const decoded = decodeReviveApiCall(
    "0x2a591a16c9ce2a591a16c9d4010000000000000000000000000000000001000000000000000000000000000000006e758d000000000000000000000000000000000000800000000000000000000000000000000000000000000000000011c37937e08000",
  );
  assert.equal(decoded.ok, true);
  assert.equal(decoded.reverted, false);
  assert.equal(BigInt(decoded.data), 5_000_000_000_000_000n);
  assert.equal(decoded.weightRequired.refTime, 92706378n);
  assert.equal(decoded.weightRequired.proofSize, 13618n);
});

test("Revive.call SCALE matches metadata-composed call bytes", () => {
  assert.equal(bytesToHex(encodeCompact(92706378n)), "0x2a591a16");
  assert.equal(bytesToHex(encodeCompact(13618n)), "0xc9d4");
  const call = encodeReviveCall({
    dest: "0x9a096C216f79e08C2DB95d92F412697D8F1f9329",
    weight: { refTime: 92706378n, proofSize: 13618n },
    data: encodeRemaining(1n),
  });
  assert.equal(
    call,
    "0x50019a096c216f79e08c2db95d92f412697d8f1f9329002a591a16c9d400900361bf140000000000000000000000000000000000000000000000000000000000000001",
  );
  assert.equal(errorSelector("NotProvider"), keccak256(toBytes("NotProvider()")).slice(0, 10));
  assert.notEqual(errorSelector("NotProvider"), errorSelector("BadSig"));
});

test("storage keys match the spec-3002 metadata hashers", () => {
  assert.equal(
    assetStorageKey("Assets", 2),
    "0x682a59d51ab9e48a8c8cc418ff9708d2d34371a193a751eea5883e9553457b2e754faa9acf0378f8c3543d9f132d85bc02000000",
  );
  assert.equal(
    reviveAccountInfoKey("0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd"),
    "0x735f040a5d490f1107ad9c56f5ca00d2ae37ff0591fdbbcd9c2406df7147a9dc9e2e2024c7dca86e57608e2cead160081c381fdd",
  );
  assert.equal(decodeReviveDust("0x0134120000"), 4660);
  const supply = decodeAssetSupply(`0x${"00".repeat(128)}${u128Hex(15_000_000_000_000_000_000n)}`);
  assert.equal(supply, 15_000_000_000_000_000_000n);
  // twox128("Assets") is the first 16 bytes of the asset key.
  assert.equal(bytesToHex(twox128("Assets")), "0x682a59d51ab9e48a8c8cc418ff9708d2");
});

function u128Hex(value: bigint): string {
  let rest = value;
  const bytes = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(Number(rest & 0xffn).toString(16).padStart(2, "0"));
    rest >>= 8n;
  }
  return bytes.join("");
}
