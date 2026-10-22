import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { portaldotV3Testnet, readTab, settleVoucher } from "agenttab-portaldot-sdk";
import type { ChainPort } from "./memory.js";

export function createRpcPort(args: {
  rpcUrl: string;
  agentTab: Address;
  providerKey?: Hex;
}): { port: ChainPort; publicClient: PublicClient; provider?: Address } {
  const publicClient = createPublicClient({ chain: portaldotV3Testnet, transport: http(args.rpcUrl) });
  const account = args.providerKey ? privateKeyToAccount(args.providerKey) : undefined;
  const walletClient = account
    ? createWalletClient({ account, chain: portaldotV3Testnet, transport: http(args.rpcUrl) })
    : undefined;
  const port: ChainPort = {
    readTab: (id) => readTab(publicClient, id, args.agentTab),
    settle:
      walletClient && account
        ? (call) =>
            settleVoucher(
              { account, publicClient, walletClient, agentTab: args.agentTab, chain: portaldotV3Testnet },
              { tabId: call.id, cumulative: call.cumulative, signature: call.signature },
            )
        : undefined,
  };
  return { port, publicClient, provider: account?.address };
}
