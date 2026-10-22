import { getAddress, type Address, type Hex } from "viem";
import { AGENT_TAB_PORTALDOT_TESTNET, DEMO_PROVIDER, PORTALDOT_V3_RPC, parseTpot } from "agenttab-portaldot-sdk";
import { isAddress, MemoryTabs, type ChainPort } from "./memory.js";
import { createRpcPort } from "./rpc.js";

export type GatewayConfig = {
  port: number;
  mode: "memory" | "rpc";
  provider: Address;
  priceWei: bigint;
  agentTab: Address;
  rpcUrl: string;
  providerKey?: Hex;
  settleEvery: number;
};

function optionalKey(value: string | undefined): Hex | undefined {
  if (!value || value === "0x...") return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("PROVIDER_PK must be a 32-byte hex key or unset");
  return value as Hex;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const mode = env.CHAIN_MODE === "rpc" ? "rpc" : "memory";
  const providerKey = optionalKey(env.PROVIDER_PK);
  const providerRaw = env.PROVIDER_ADDRESS ?? (mode === "memory" ? DEMO_PROVIDER : undefined);
  if (!providerRaw || !isAddress(providerRaw)) {
    throw new Error("set PROVIDER_ADDRESS (the tab's provider) before starting in rpc mode");
  }
  const priceWei = env.PRICE_WEI ? BigInt(env.PRICE_WEI) : env.PRICE_TPOT ? parseTpot(env.PRICE_TPOT) : 10n ** 14n;
  return {
    port: Number(env.PORT ?? 8402),
    mode,
    provider: getAddress(providerRaw),
    priceWei,
    agentTab: getAddress(env.AGENT_TAB ?? AGENT_TAB_PORTALDOT_TESTNET),
    rpcUrl: env.PORTALDOT_RPC ?? PORTALDOT_V3_RPC,
    providerKey,
    settleEvery: Number(env.SETTLE_EVERY ?? 5),
  };
}

export function chainForConfig(config: GatewayConfig): ChainPort {
  if (config.mode === "memory") return new MemoryTabs();
  const { port, provider } = createRpcPort({
    rpcUrl: config.rpcUrl,
    agentTab: config.agentTab,
    providerKey: config.providerKey,
  });
  if (provider && getAddress(provider) !== config.provider) {
    throw new Error("PROVIDER_PK address does not match PROVIDER_ADDRESS");
  }
  return port;
}
