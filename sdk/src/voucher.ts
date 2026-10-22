import {
  encodeAbiParameters,
  encodePacked,
  getAddress,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  toBytes,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from "viem";
import { agentTabDomain, voucherTypes, VOUCHER_TYPEHASH } from "./abi.js";
import { AGENT_TAB_PORTALDOT_TESTNET, NATIVE, PORTALDOT_V3_CHAIN_ID, VOUCHER_HEADER } from "./chain.js";
import { assertUint128, formatTpot, SUBSTRATE_DECIMALS, EVM_DECIMALS, WEI_PER_PLANCK, weiToPlanck } from "./tpot.js";

export type SignedVoucher = {
  tabId: bigint;
  cumulative: bigint;
  signature: Hex;
};

export type TabState = {
  payer: Address;
  provider: Address;
  token: Address;
  deposit: bigint;
  claimed: bigint;
  expiry: bigint;
};

export type VoucherError =
  | "no_tab"
  | "wrong_provider"
  | "unsupported_token"
  | "expired"
  | "exceeds_deposit"
  | "stale"
  | "below_price"
  | "bad_signature";

export type VoucherDecision =
  | { ok: true; cumulative: bigint; delta: bigint; payer: Address }
  | { ok: false; error: VoucherError };

type Domain = ReturnType<typeof agentTabDomain>;

/** Solidity `AgentTab.digest`: keccak256(0x1901 || domainSeparator || structHash). */
export function digestVoucher(tabId: bigint, cumulative: bigint, domain: Domain = agentTabDomain(AGENT_TAB_PORTALDOT_TESTNET)): Hex {
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        keccak256(toBytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(toBytes(domain.name)),
        keccak256(toBytes(domain.version)),
        BigInt(domain.chainId),
        domain.verifyingContract,
      ],
    ),
  );
  const structHash = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
      [VOUCHER_TYPEHASH, tabId, cumulative],
    ),
  );
  return keccak256(encodePacked(["bytes2", "bytes32", "bytes32"], ["0x1901", domainSeparator, structHash]));
}

export function typedDataHash(tabId: bigint, cumulative: bigint, domain: Domain = agentTabDomain(AGENT_TAB_PORTALDOT_TESTNET)): Hex {
  return hashTypedData({
    domain,
    types: voucherTypes,
    primaryType: "Voucher",
    message: { tabId, cumulative },
  });
}

export async function signVoucher(
  account: { signTypedData: (parameters: TypedDataDefinition<typeof voucherTypes, "Voucher">) => Promise<Hex> },
  args: { tabId: bigint; cumulative: bigint; verifyingContract?: Address; chainId?: number },
): Promise<Hex> {
  assertUint128(args.cumulative, "cumulative");
  if (args.tabId < 0n) throw new Error("tabId is negative");
  const domain = agentTabDomain(args.verifyingContract ?? AGENT_TAB_PORTALDOT_TESTNET, args.chainId ?? PORTALDOT_V3_CHAIN_ID);
  return account.signTypedData({
    domain,
    types: voucherTypes,
    primaryType: "Voucher",
    message: { tabId: args.tabId, cumulative: args.cumulative },
  });
}

export function encodeVoucherHeader(voucher: SignedVoucher): string {
  return JSON.stringify({
    tabId: voucher.tabId.toString(),
    cumulative: voucher.cumulative.toString(),
    signature: voucher.signature,
  });
}

export function decodeVoucherHeader(raw: string): SignedVoucher {
  let text = raw.trim();
  if (!text.startsWith("{")) {
    const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + pad;
    text = atob(b64);
  }
  let parsed: { tabId?: string; cumulative?: string; signature?: string };
  try {
    parsed = JSON.parse(text) as { tabId?: string; cumulative?: string; signature?: string };
  } catch {
    throw new Error("malformed voucher header");
  }
  if (typeof parsed.tabId !== "string" || typeof parsed.cumulative !== "string" || typeof parsed.signature !== "string") {
    throw new Error("malformed voucher header");
  }
  if (parsed.tabId.startsWith("-") || parsed.cumulative.startsWith("-")) throw new Error("negative voucher field");
  if (!/^0x[0-9a-fA-F]{130}$/.test(parsed.signature)) throw new Error("voucher signature must be 65 bytes");
  return {
    tabId: BigInt(parsed.tabId),
    cumulative: BigInt(parsed.cumulative),
    signature: parsed.signature as Hex,
  };
}

/**
 * Decide whether a cumulative voucher pays for one more call.
 * `baseline` is the greater of on-chain `claimed` and the last cumulative this
 * process already accepted (so a voucher cannot be replayed before settle).
 * Signature is checked after the economic checks.
 */
export async function evaluateVoucher(args: {
  voucher: SignedVoucher;
  tab: TabState | null;
  expectedProvider: Address;
  priceWei: bigint;
  baseline: bigint;
  now: bigint;
  verifyingContract?: Address;
  chainId?: number;
  nativeOnly?: boolean;
}): Promise<VoucherDecision> {
  const { voucher, tab } = args;
  if (!tab || tab.payer === NATIVE) return { ok: false, error: "no_tab" };
  if (getAddress(tab.provider) !== getAddress(args.expectedProvider)) return { ok: false, error: "wrong_provider" };
  if ((args.nativeOnly ?? true) && getAddress(tab.token) !== NATIVE) return { ok: false, error: "unsupported_token" };
  if (args.now >= tab.expiry) return { ok: false, error: "expired" };
  if (voucher.cumulative > tab.deposit) return { ok: false, error: "exceeds_deposit" };
  if (voucher.cumulative <= args.baseline) return { ok: false, error: "stale" };
  const delta = voucher.cumulative - args.baseline;
  if (delta < args.priceWei) return { ok: false, error: "below_price" };

  const domain = agentTabDomain(args.verifyingContract ?? AGENT_TAB_PORTALDOT_TESTNET, args.chainId ?? PORTALDOT_V3_CHAIN_ID);
  let recovered: Address;
  try {
    recovered = await recoverTypedDataAddress({
      domain,
      types: voucherTypes,
      primaryType: "Voucher",
      message: { tabId: voucher.tabId, cumulative: voucher.cumulative },
      signature: voucher.signature,
    });
  } catch {
    return { ok: false, error: "bad_signature" };
  }
  if (getAddress(recovered) !== getAddress(tab.payer)) return { ok: false, error: "bad_signature" };
  return { ok: true, cumulative: voucher.cumulative, delta, payer: getAddress(tab.payer) };
}

export type AgentTabChallenge = {
  error: "payment_required";
  rail: "agenttab";
  description: string;
  price: {
    amountWei: string;
    amountTpot: string;
    amountPlanck: string;
    token: Address;
    symbol: "tPOT";
    evmDecimals: number;
    substrateDecimals: number;
    weiPerPlanck: string;
  };
  accept: {
    scheme: "agenttab";
    network: `eip155:${number}`;
    chainId: number;
    contract: Address;
    payTo: Address;
    token: Address;
    header: typeof VOUCHER_HEADER;
    voucher: {
      primaryType: "Voucher";
      domain: { name: "AgentTab"; version: "1"; chainId: number; verifyingContract: Address };
      types: typeof voucherTypes;
    };
    open: {
      method: "open";
      payable: true;
      token: Address;
      value: "depositWei";
      args: ["provider", "token", "amount", "expiry"];
      note: string;
    };
  };
};

/** Body of an unpaid HTTP 402. AgentTab rail only — no x402 facilitator and no stablecoin asset. */
export function paymentChallenge(args: {
  provider: Address;
  priceWei: bigint;
  agentTab?: Address;
  chainId?: number;
}): AgentTabChallenge {
  const chainId = args.chainId ?? PORTALDOT_V3_CHAIN_ID;
  const contract = args.agentTab ?? AGENT_TAB_PORTALDOT_TESTNET;
  const domain = agentTabDomain(contract, chainId);
  return {
    error: "payment_required",
    rail: "agenttab",
    description: "Escrow native tPOT once with AgentTab.open, then send a cumulative EIP-712 voucher per call.",
    price: {
      amountWei: args.priceWei.toString(),
      amountTpot: formatTpot(args.priceWei, 8),
      amountPlanck: weiToPlanck(args.priceWei).toString(),
      token: NATIVE,
      symbol: "tPOT",
      evmDecimals: EVM_DECIMALS,
      substrateDecimals: SUBSTRATE_DECIMALS,
      weiPerPlanck: WEI_PER_PLANCK.toString(),
    },
    accept: {
      scheme: "agenttab",
      network: `eip155:${chainId}`,
      chainId,
      contract,
      payTo: getAddress(args.provider),
      token: NATIVE,
      header: VOUCHER_HEADER,
      voucher: {
        primaryType: "Voucher",
        domain,
        types: voucherTypes,
      },
      open: {
        method: "open",
        payable: true,
        token: NATIVE,
        value: "depositWei",
        args: ["provider", "token", "amount", "expiry"],
        note: "Call open{value: depositWei}(payTo, address(0), depositWei, expiry). depositWei must be a multiple of 10000 so it maps to integer substrate planck. Then sign Voucher(tabId, cumulative) with this domain and send it in X-AgentTab-Voucher.",
      },
    },
  };
}
