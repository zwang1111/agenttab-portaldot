import { defineChain, getAddress, zeroAddress, type Address } from "viem";

/** Portaldot V3 public testnet. EVM chain id is 420420777 (0x190f1ca9). */
export const PORTALDOT_V3_CHAIN_ID = 420420777;

export const PORTALDOT_V3_RPC = "https://test-evm-rpc-v3.portaldot.dev";

export const PORTALDOT_V3_SUBSTRATE_RPC = "wss://test-node-v3.portaldot.dev";

export const PORTALDOT_V3_EXPLORER = "https://node-console.portaldot.dev";

/**
 * AgentTab deployed 2026-10-22. See deployments/portaldot-testnet.json.
 * Native tPOT tabs use `token = address(0)` and a payable `open` / `topUp`.
 */
export const AGENT_TAB_PORTALDOT_TESTNET = getAddress("0x9a096C216f79e08C2DB95d92F412697D8F1f9329");

/** Demo provider funded in the check-in open/settle run. Not a secret. */
export const DEMO_PROVIDER = getAddress("0x7F220d4db849E7Ee220f9F8fdD99fc016b3F3369");

/**
 * EVM wallets (MetaMask default) display this RPC's native balance with 18 decimals.
 * The Substrate token itself is 14 decimals; convert with `tpot.ts` at the boundary.
 * Setting `decimals: 18` matches a deployer balance of ~167 tPOT on this RPC.
 */
export const portaldotV3Testnet = defineChain({
  id: PORTALDOT_V3_CHAIN_ID,
  name: "Portaldot V3 Testnet",
  nativeCurrency: { name: "tPOTv3", symbol: "tPOT", decimals: 18 },
  rpcUrls: { default: { http: [PORTALDOT_V3_RPC] } },
  blockExplorers: {
    default: { name: "Portaldot Node Console", url: PORTALDOT_V3_EXPLORER },
  },
  testnet: true,
});

/** `token` argument for a native tPOT tab. Matches `AgentTab.NATIVE`. */
export const NATIVE: Address = zeroAddress;

export const VOUCHER_HEADER = "X-AgentTab-Voucher";
