/**
 * Offline proof of the pay-per-call path.
 * No Portaldot RPC and no funded key: an in-memory tab plus a key generated
 * in-process (never written to disk).
 *
 *   npm run dry-run
 */
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NATIVE, encodeVoucherHeader, parseTpot, signVoucher } from "agenttab-portaldot-sdk";
import { createGateway } from "./app.js";
import { MemoryTabs } from "./memory.js";

type Log = (line: string) => void;

export async function runDryRun(log: Log = (line) => console.log(line)): Promise<void> {
  const payer = privateKeyToAccount(generatePrivateKey());
  const provider = privateKeyToAccount(generatePrivateKey());
  const price = parseTpot("0.0001");
  const chain = new MemoryTabs();
  chain.settleTx = `0x${"44".repeat(32)}`;
  chain.put(1n, {
    payer: payer.address,
    provider: provider.address,
    token: NATIVE,
    deposit: parseTpot("0.01"),
    claimed: 0n,
    expiry: 2_000_000_000n,
  });
  const app = createGateway({
    provider: provider.address,
    chain,
    priceWei: price,
    settleEvery: 1,
    now: () => 1_700_000_000n,
  });
  const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
  try {
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("gateway failed to bind");
    const base = `http://127.0.0.1:${address.port}`;

    const unpaid = await fetch(`${base}/quote`);
    const challenge = await unpaid.json();
    if (unpaid.status !== 402) throw new Error(`expected 402, got ${unpaid.status}`);
    if (challenge.rail !== "agenttab" || challenge.accept?.chainId !== 420420777) {
      throw new Error("402 body is not the Portaldot AgentTab rail");
    }
    log(`402 ${challenge.price.amountTpot} tPOT  chain ${challenge.accept.chainId}  contract ${challenge.accept.contract}`);

    const signature = await signVoucher(payer, { tabId: 1n, cumulative: price });
    const paid = await fetch(`${base}/quote?q=dry-run`, {
      headers: { "X-AgentTab-Voucher": encodeVoucherHeader({ tabId: 1n, cumulative: price, signature }) },
    });
    const body = await paid.json();
    if (paid.status !== 200) throw new Error(`expected 200, got ${paid.status} ${JSON.stringify(body)}`);
    if (body.payment?.settle?.status !== "submitted") throw new Error("expected an in-memory settle");
    log(`200 tab ${body.payment.tabId} cumulative ${body.payment.cumulativeWei} settle ${body.payment.settle.status}`);

    const replay = await fetch(`${base}/quote`, {
      headers: { "X-AgentTab-Voucher": encodeVoucherHeader({ tabId: 1n, cumulative: price, signature }) },
    });
    if (replay.status !== 402) throw new Error("replay should be 402");
    log(`402 replay ${(await replay.json()).error}`);
    log("dry-run ok");
  } finally {
    await shutdown(server);
  }
}

async function shutdown(server: { close(callback?: (err?: Error) => void): void }): Promise<void> {
  const httpServer = server as { closeAllConnections?: () => void; close(callback?: (err?: Error) => void): void };
  httpServer.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  runDryRun().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
