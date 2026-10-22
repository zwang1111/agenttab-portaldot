/**
 * One paid call against a gateway that is already running.
 *
 *   API_BASE=http://127.0.0.1:8402 TAB_ID=1 AGENT_PK=0x... CUMULATIVE=100000000000000 npm run call
 *
 * If CUMULATIVE is omitted, PORTALDOT_RPC is used to read tabs(id).claimed and
 * the new cumulative is claimed + price from the 402 body. The key is never printed.
 */
import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  AGENT_TAB_PORTALDOT_TESTNET,
  PORTALDOT_V3_RPC,
  encodeVoucherHeader,
  portaldotV3Testnet,
  readTab,
  signVoucher,
} from "agenttab-portaldot-sdk";
import { pathToFileURL } from "node:url";

export async function payOneCall(env: NodeJS.ProcessEnv = process.env): Promise<unknown> {
  const base = env.API_BASE ?? "http://127.0.0.1:8402";
  const tabId = BigInt(env.TAB_ID ?? "");
  if (tabId <= 0n) throw new Error("set TAB_ID");
  const pk = env.AGENT_PK;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error("set AGENT_PK to a throwaway testnet key");
  const account = privateKeyToAccount(pk as Hex);

  const challengeRes = await fetch(`${base}/quote`);
  const challenge = await challengeRes.json();
  if (challengeRes.status !== 402) throw new Error(`expected 402 from ${base}/quote, got ${challengeRes.status}`);
  const priceWei = BigInt(challenge.price.amountWei as string);
  const agentTab = (challenge.accept.contract as Hex | undefined) ?? AGENT_TAB_PORTALDOT_TESTNET;

  let cumulative: bigint;
  if (env.CUMULATIVE) cumulative = BigInt(env.CUMULATIVE);
  else {
    const rpc = env.PORTALDOT_RPC ?? PORTALDOT_V3_RPC;
    const publicClient = createPublicClient({ chain: portaldotV3Testnet, transport: http(rpc) });
    const tab = await readTab(publicClient, tabId, agentTab);
    if (!tab) throw new Error(`tab ${tabId} is not open at ${agentTab}`);
    cumulative = tab.claimed + priceWei;
  }

  const signature = await signVoucher(account, { tabId, cumulative, verifyingContract: agentTab, chainId: challenge.accept.chainId });
  const paid = await fetch(`${base}/quote`, {
    headers: { "X-AgentTab-Voucher": encodeVoucherHeader({ tabId, cumulative, signature }) },
  });
  const body = await paid.json();
  if (paid.status !== 200) throw new Error(`paid call failed (${paid.status}): ${JSON.stringify(body)}`);
  return body;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  payOneCall()
    .then((body) => console.log(JSON.stringify(body)))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
