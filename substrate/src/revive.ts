import { encodeFunctionData, keccak256, toBytes, type Address, type Hex } from "viem";
import {
  AGENT_TAB_PORTALDOT_TESTNET,
  agentTabAbi,
  assetsErc20Precompile,
  ASSETS_ERC20_PREFIX,
} from "agenttab-portaldot-sdk";
import { bytesToHex, concatBytes, encodeCompact, encodeU128LE, hexToBytes, ScaleReader } from "./scale.ts";

/** Pallet index of `Revive` in `portaldot-v3` spec 3002. Call index of `Revive.call`. */
export const REVIVE_PALLET_INDEX = 80;
export const REVIVE_CALL_INDEX = 1;

export const EXISTENTIAL_DEPOSIT_PLANCK = 10n ** 13n;
export const WEI_PER_PLANCK = 10_000n;

/**
 * Public origin used for dry-runs: the fallback AccountId32 of the published
 * deployer H160 (`H160 || 0xEE * 12`). No secret. `ReviveApi_call` does not sign.
 */
export const DEPLOYER_H160: Address = "0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd";

const AGENT_TAB_ERRORS = [
  "BadSig",
  "NotProvider",
  "NotPayer",
  "Exceeds",
  "NotExpired",
  "Stale",
  "TransferFailed",
  "BadValue",
  "Reentrancy",
  "NoTab",
] as const;

export function errorSelector(name: (typeof AGENT_TAB_ERRORS)[number]): Hex {
  return keccak256(toBytes(`${name}()`)).slice(0, 10) as Hex;
}

/** AccountId32 → H160, matching pallet-revive `AccountId32Mapper` on this runtime. */
export function accountIdToH160(accountId: Uint8Array): Address {
  if (accountId.length !== 32) throw new Error("account id must be 32 bytes");
  const ethDerived = accountId.subarray(20).every((byte) => byte === 0xee);
  if (ethDerived) return bytesToHex(accountId.subarray(0, 20)) as Address;
  const hash = keccak256(accountId);
  return `0x${hash.slice(-40)}` as Address;
}

export function h160ToFallbackAccountId(address: Address): Uint8Array {
  const out = new Uint8Array(32);
  out.fill(0xee);
  out.set(hexToBytes(address), 0);
  return out;
}

export function deployerFallbackAccountId(): Uint8Array {
  return h160ToFallbackAccountId(DEPLOYER_H160);
}

/**
 * EVM balance reported by eth_getBalance / ReviveApi_balance for an account
 * whose reducible planck are `free - existentialDeposit`, plus revive dust.
 * Checked against the deployer fallback account in the live probe.
 */
export function evmBalanceFromFree(freePlanck: bigint, dustWei: bigint): bigint {
  if (freePlanck < EXISTENTIAL_DEPOSIT_PLANCK) {
    throw new Error("free balance is below the existential deposit");
  }
  return (freePlanck - EXISTENTIAL_DEPOSIT_PLANCK) * WEI_PER_PLANCK + dustWei;
}

export type ReviveWeight = { refTime: bigint; proofSize: bigint };

/**
 * SCALE params for `state_call("ReviveApi_call", ...)`.
 * Value is a plain u128. Gas limit and storage-deposit limit are Options;
 * pass null to let the runtime pick them (the Portaldot guide's read path).
 */
export function encodeReviveApiCall(args: {
  origin: Uint8Array;
  dest: Address;
  value?: bigint;
  gasLimit?: ReviveWeight | null;
  storageDepositLimit?: bigint | null;
  data: Hex;
}): Uint8Array {
  if (args.origin.length !== 32) throw new Error("origin must be AccountId32");
  const parts: Uint8Array[] = [
    args.origin,
    hexToBytes(args.dest),
    encodeU128LE(args.value ?? 0n),
  ];
  if (!args.gasLimit) parts.push(Uint8Array.of(0));
  else {
    parts.push(Uint8Array.of(1), encodeCompact(args.gasLimit.refTime), encodeCompact(args.gasLimit.proofSize));
  }
  if (args.storageDepositLimit == null) parts.push(Uint8Array.of(0));
  else parts.push(Uint8Array.of(1), encodeU128LE(args.storageDepositLimit));
  const calldata = hexToBytes(args.data);
  parts.push(encodeCompact(BigInt(calldata.length)), calldata);
  return concatBytes(...parts);
}

export type ReviveCallResult = {
  weightConsumed: ReviveWeight;
  weightRequired: ReviveWeight;
  storageDeposit: { kind: "Refund" | "Charge"; amount: bigint };
  gasConsumed: bigint;
  ok: boolean;
  flags: number;
  data: Hex;
  reverted: boolean;
  errorName?: string;
  dispatchErrorHex?: Hex;
};

function readDeposit(reader: ScaleReader): { kind: "Refund" | "Charge"; amount: bigint } {
  const tag = reader.u8();
  const amount = reader.u128();
  if (tag !== 0 && tag !== 1) throw new Error(`unknown storage deposit tag ${tag}`);
  return { kind: tag === 0 ? "Refund" : "Charge", amount };
}

/** Decode `ContractResult` from `ReviveApi_call` as returned by spec 3002. */
export function decodeReviveApiCall(raw: Hex): ReviveCallResult {
  const reader = new ScaleReader(hexToBytes(raw));
  const weight = () => ({ refTime: reader.compact(), proofSize: reader.compact() });
  const weightConsumed = weight();
  const weightRequired = weight();
  const storageDeposit = readDeposit(reader);
  readDeposit(reader); // max storage deposit, unused by callers
  const gasConsumed = reader.u128();
  const tag = reader.u8();
  if (tag === 0) {
    const flags = reader.u32();
    const dataBytes = reader.bytes();
    const data = bytesToHex(dataBytes);
    const reverted = (flags & 1) === 1;
    const errorName = AGENT_TAB_ERRORS.find((name) => errorSelector(name) === data);
    return {
      weightConsumed,
      weightRequired,
      storageDeposit,
      gasConsumed,
      ok: !reverted,
      flags,
      data,
      reverted,
      errorName,
    };
  }
  const rest = reader.remaining > 0 ? bytesToHex(hexToBytes(raw).subarray(hexToBytes(raw).length - reader.remaining)) : "0x";
  return {
    weightConsumed,
    weightRequired,
    storageDeposit,
    gasConsumed,
    ok: false,
    flags: 0,
    data: "0x",
    reverted: true,
    dispatchErrorHex: rest,
  };
}

/**
 * SCALE of the `Revive.call` extrinsic *call* (not a signed extrinsic).
 * Pallet index and call index are plain bytes. `value`, both weight fields,
 * and `storageDepositLimit` are compact, which is how spec 3002 encodes them.
 */
export function encodeReviveCall(args: {
  dest: Address;
  value?: bigint;
  weight: ReviveWeight;
  storageDepositLimit?: bigint;
  data: Hex;
}): Hex {
  const calldata = hexToBytes(args.data);
  return bytesToHex(
    concatBytes(
      Uint8Array.of(REVIVE_PALLET_INDEX, REVIVE_CALL_INDEX),
      hexToBytes(args.dest),
      encodeCompact(args.value ?? 0n),
      encodeCompact(args.weight.refTime),
      encodeCompact(args.weight.proofSize),
      encodeCompact(args.storageDepositLimit ?? 0n),
      encodeCompact(BigInt(calldata.length)),
      calldata,
    ),
  );
}

export function encodeRemaining(tabId: bigint): Hex {
  return encodeFunctionData({
    abi: agentTabAbi,
    functionName: "remaining",
    args: [tabId],
  });
}

export function encodeTabs(tabId: bigint): Hex {
  return encodeFunctionData({ abi: agentTabAbi, functionName: "tabs", args: [tabId] });
}

export function encodeNextId(): Hex {
  return keccak256(toBytes("nextId()")).slice(0, 10) as Hex;
}

export function encodeTotalSupply(): Hex {
  return encodeFunctionData({
    abi: [{ type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
    functionName: "totalSupply",
    args: [],
  });
}

export function encodeErc20String(name: "name" | "symbol"): Hex {
  return encodeFunctionData({
    abi: [{ type: "function", name, stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
    functionName: name,
    args: [],
  });
}

export function encodeDecimals(): Hex {
  return encodeFunctionData({
    abi: [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
    functionName: "decimals",
    args: [],
  });
}

export function encodeSettle(tabId: bigint, cumulative: bigint, signature: Hex): Hex {
  return encodeFunctionData({
    abi: agentTabAbi,
    functionName: "settle",
    args: [tabId, cumulative, signature],
  });
}

export const TEST_ASSET_ID = 2;
export const TEST_ASSET_PRECOMPILE = assetsErc20Precompile(TEST_ASSET_ID, ASSETS_ERC20_PREFIX);
export const AGENT_TAB = AGENT_TAB_PORTALDOT_TESTNET;
