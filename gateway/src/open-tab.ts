/**
 * Open a native tPOT tab on Portaldot V3. Requires a funded throwaway key.
 * Gas uses eth_estimateGas and a legacy transaction (pallet-revive).
 *
 *   AGENT_PK=0x... PROVIDER_ADDRESS=0x... DEPOSIT_TPOT=0.01 npm run open-tab
 *
 * The key is never printed. Fund the mapped Substrate account, not only the H160.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pathToFileURL } from "node:url";
import {
  AGENT_TAB_PORTALDOT_TESTNET,
  DEMO_PROVIDER,
  PORTALDOT_V3_RPC,
  openNativeTab,
  parseTpot,
  portaldotV3Testnet,
  tabIdFromReceipt,
} from "agenttab-portaldot-sdk";

export async function openTabFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<{ hash: Hex; tabId: bigint }> {
  const pk = env.AGENT_PK;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error("set AGENT_PK to a throwaway testnet key");
  const provider = (env.PROVIDER_ADDRESS ?? DEMO_PROVIDER) as Address;
  const depositWei = parseTpot(env.DEPOSIT_TPOT ?? "0.01");
  const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(env.EXPIRY_SECS ?? 86_400));
  const account = privateKeyToAccount(pk as Hex);
  const rpc = env.PORTALDOT_RPC ?? PORTALDOT_V3_RPC;
  const agentTab = (env.AGENT_TAB as Address | undefined) ?? AGENT_TAB_PORTALDOT_TESTNET;
  const transport = http(rpc);
  const publicClient = createPublicClient({ chain: portaldotV3Testnet, transport });
  const walletClient = createWalletClient({ account, chain: portaldotV3Testnet, transport });
  const hash = await openNativeTab(
    { account, publicClient, walletClient, agentTab, chain: portaldotV3Testnet },
    { provider, depositWei, expiry },
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`open reverted: ${hash}`);
  return { hash, tabId: tabIdFromReceipt(receipt) };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  openTabFromEnv()
    .then(({ hash, tabId }) => console.log(JSON.stringify({ hash, tabId: tabId.toString() })))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
