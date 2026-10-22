import {
  encodeFunctionData,
  getAddress,
  parseEventLogs,
  zeroAddress,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { agentTabAbi } from "./abi.js";
import { AGENT_TAB_PORTALDOT_TESTNET, NATIVE, portaldotV3Testnet } from "./chain.js";
import { assertPlanckAligned, assertUint128, assertUint64 } from "./tpot.js";
import type { TabState } from "./voucher.js";

export type AgentTabWriter = {
  account: Account;
  publicClient: PublicClient;
  walletClient: WalletClient;
  agentTab?: Address;
  chain?: Chain;
};

export type Calldata = {
  to: Address;
  data: Hex;
  value: bigint;
  token: Address;
};

function tabAddress(agentTab?: Address): Address {
  return agentTab ?? AGENT_TAB_PORTALDOT_TESTNET;
}

/** Read `tabs(id)`. A zero payer means the id was never opened. */
export async function readTab(client: PublicClient, id: bigint, agentTab?: Address): Promise<TabState | null> {
  const row = await client.readContract({
    address: tabAddress(agentTab),
    abi: agentTabAbi,
    functionName: "tabs",
    args: [id],
  });
  const [payer, provider, token, deposit, claimed, expiry] = row;
  if (payer === zeroAddress) return null;
  return {
    payer: getAddress(payer),
    provider: getAddress(provider),
    token: getAddress(token),
    deposit,
    claimed,
    expiry,
  };
}

export function buildOpenNativeTab(args: {
  provider: Address;
  depositWei: bigint;
  expiry: bigint;
  agentTab?: Address;
  allowUnaligned?: boolean;
}): Calldata {
  if (getAddress(args.provider) === zeroAddress) throw new Error("provider is zero");
  if (!args.allowUnaligned) assertPlanckAligned(args.depositWei, "depositWei");
  assertUint128(args.depositWei, "depositWei");
  assertUint64(args.expiry, "expiry");
  const to = tabAddress(args.agentTab);
  const data = encodeFunctionData({
    abi: agentTabAbi,
    functionName: "open",
    args: [args.provider, NATIVE, args.depositWei, args.expiry],
  });
  return { to, data, value: args.depositWei, token: NATIVE };
}

export function buildTopUpNativeTab(args: {
  tabId: bigint;
  amountWei: bigint;
  newExpiry: bigint;
  agentTab?: Address;
  allowUnaligned?: boolean;
}): Calldata {
  if (!args.allowUnaligned) assertPlanckAligned(args.amountWei, "amountWei");
  assertUint128(args.amountWei, "amountWei");
  assertUint64(args.newExpiry, "newExpiry");
  const to = tabAddress(args.agentTab);
  const data = encodeFunctionData({
    abi: agentTabAbi,
    functionName: "topUp",
    args: [args.tabId, args.amountWei, args.newExpiry],
  });
  return { to, data, value: args.amountWei, token: NATIVE };
}

export function buildSettle(args: { tabId: bigint; cumulative: bigint; signature: Hex; agentTab?: Address }): Calldata {
  assertUint128(args.cumulative, "cumulative");
  const to = tabAddress(args.agentTab);
  const data = encodeFunctionData({
    abi: agentTabAbi,
    functionName: "settle",
    args: [args.tabId, args.cumulative, args.signature],
  });
  return { to, data, value: 0n, token: NATIVE };
}

export function tabIdFromReceipt(receipt: TransactionReceipt | { logs: TransactionReceipt["logs"] }): bigint {
  const parsed = parseEventLogs({ abi: agentTabAbi, logs: receipt.logs, eventName: "Opened" });
  const first = parsed[0];
  if (!first) throw new Error("open receipt has no Opened event");
  return first.args.id;
}

/**
 * Portaldot's eth-rpc packs weight and storage deposit into `eth_estimateGas`.
 * A default viem gas limit is rejected (`Invalid Transaction` / OOG). Send a
 * legacy transaction whose gas limit is that estimate, same as scripts/deploy.sh.
 */
async function writeLegacy(
  writer: AgentTabWriter,
  functionName: "open" | "topUp" | "settle" | "refund",
  args: readonly unknown[],
  value?: bigint,
): Promise<Hex> {
  const address = tabAddress(writer.agentTab);
  const chain = writer.chain ?? portaldotV3Testnet;
  const request = {
    address,
    abi: agentTabAbi,
    functionName,
    args,
    value,
    account: writer.account,
  };
  // viem's gas union is keyed by function name. The public helpers above already
  // check uint128/uint64 and the native token; this cast only hides that union.
  const gas = await writer.publicClient.estimateContractGas(request as never);
  const gasPrice = await writer.publicClient.getGasPrice();
  return writer.walletClient.writeContract({
    ...request,
    chain,
    gas,
    gasPrice,
    type: "legacy",
  } as never);
}

export function openNativeTab(
  writer: AgentTabWriter,
  args: { provider: Address; depositWei: bigint; expiry: bigint; allowUnaligned?: boolean },
): Promise<Hex> {
  const call = buildOpenNativeTab({ ...args, agentTab: writer.agentTab });
  return writeLegacy(writer, "open", [args.provider, NATIVE, args.depositWei, args.expiry], call.value);
}

export function topUpNativeTab(
  writer: AgentTabWriter,
  args: { tabId: bigint; amountWei: bigint; newExpiry: bigint; allowUnaligned?: boolean },
): Promise<Hex> {
  const call = buildTopUpNativeTab({ ...args, agentTab: writer.agentTab });
  return writeLegacy(writer, "topUp", [args.tabId, args.amountWei, args.newExpiry], call.value);
}

export function settleVoucher(
  writer: AgentTabWriter,
  args: { tabId: bigint; cumulative: bigint; signature: Hex },
): Promise<Hex> {
  buildSettle({ ...args, agentTab: writer.agentTab });
  return writeLegacy(writer, "settle", [args.tabId, args.cumulative, args.signature]);
}

export function refundTab(writer: AgentTabWriter, tabId: bigint): Promise<Hex> {
  return writeLegacy(writer, "refund", [tabId]);
}
