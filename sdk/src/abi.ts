import { keccak256, toBytes, type Address, type Hex } from "viem";
import { PORTALDOT_V3_CHAIN_ID } from "./chain.js";

/** Mirrors `AgentTab.VOUCHER_TYPEHASH` in src/AgentTab.sol. */
export const VOUCHER_TYPEHASH: Hex = keccak256(toBytes("Voucher(uint256 tabId,uint256 cumulative)"));

export const voucherTypes = {
  Voucher: [
    { name: "tabId", type: "uint256" },
    { name: "cumulative", type: "uint256" },
  ],
} as const;

export function agentTabDomain(verifyingContract: Address, chainId: number = PORTALDOT_V3_CHAIN_ID) {
  return {
    name: "AgentTab",
    version: "1",
    chainId,
    verifyingContract,
  } as const;
}

/**
 * Payable `open` / `topUp` — the Portaldot port. Do not reuse a nonpayable ABI
 * from the Celo sibling; native tPOT is `msg.value`, not an ERC-20 approval.
 */
export const agentTabAbi = [
  {
    type: "function",
    name: "open",
    stateMutability: "payable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "topUp",
    stateMutability: "payable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint128" },
      { name: "newExpiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "cumulative", type: "uint128" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "remaining",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tabs",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "payer", type: "address" },
      { name: "provider", type: "address" },
      { name: "token", type: "address" },
      { name: "deposit", type: "uint128" },
      { name: "claimed", type: "uint128" },
      { name: "expiry", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "digest",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "cumulative", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "Opened",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "paid", type: "uint256", indexed: false },
      { name: "cumulative", type: "uint256", indexed: false },
    ],
  },
] as const;
