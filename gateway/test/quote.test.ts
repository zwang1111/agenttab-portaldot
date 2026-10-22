import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { serve } from "@hono/node-server";
import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NATIVE, signVoucher, encodeVoucherHeader, parseTpot, type TabState } from "agenttab-portaldot-sdk";
import { createGateway } from "../src/app.ts";
import { configFromEnv } from "../src/config.ts";
import { MemoryTabs } from "../src/memory.ts";

const price = parseTpot("0.0001");
const payerKey = generatePrivateKey();
const payer = privateKeyToAccount(payerKey);
const provider = privateKeyToAccount(generatePrivateKey()).address;

function seed(): { chain: MemoryTabs; tab: TabState } {
  const chain = new MemoryTabs();
  const tab: TabState = {
    payer: payer.address,
    provider,
    token: NATIVE,
    deposit: parseTpot("0.01"),
    claimed: 0n,
    expiry: 2_000_000_000n,
  };
  chain.put(1n, tab);
  return { chain, tab };
}

function appFor(chain: MemoryTabs, settleEvery = 2) {
  return createGateway({
    provider,
    chain,
    priceWei: price,
    settleEvery,
    now: () => 1_700_000_000n,
  });
}

async function voucherHeader(cumulative: bigint) {
  const signature = await signVoucher(payer, { tabId: 1n, cumulative });
  return encodeVoucherHeader({ tabId: 1n, cumulative, signature });
}

test("unpaid GET /quote is HTTP 402 with native tPOT AgentTab terms", async () => {
  const { chain } = seed();
  const res = await appFor(chain).request("http://127.0.0.1/quote");
  assert.equal(res.status, 402);
  assert.match(res.headers.get("x-agenttab-required") ?? "", /agenttab; chain=420420777/);
  const body = await res.json();
  assert.equal(body.error, "payment_required");
  assert.equal(body.rail, "agenttab");
  assert.equal(body.accept.scheme, "agenttab");
  assert.equal(body.accept.chainId, 420420777);
  assert.equal(body.accept.network, "eip155:420420777");
  assert.equal(body.accept.contract, "0x9a096C216f79e08C2DB95d92F412697D8F1f9329");
  assert.equal(body.accept.payTo, provider);
  assert.equal(body.accept.token, NATIVE);
  assert.equal(body.price.amountWei, price.toString());
  assert.equal(body.price.amountTpot, "0.0001");
  assert.equal(body.price.substrateDecimals, 14);
  assert.equal(body.price.evmDecimals, 18);
  assert.equal(body.accept.open.payable, true);
  assert.equal(body.accept.header, "X-AgentTab-Voucher");
  const blob = JSON.stringify(body).toLowerCase();
  assert.equal(blob.includes("x402"), false);
  assert.equal(blob.includes("usat"), false);
  assert.equal(blob.includes("facilitator"), false);
});

test("a signed cumulative voucher is accepted once and a replay is 402", async () => {
  const { chain } = seed();
  const app = appFor(chain);
  const first = await app.request("http://127.0.0.1/quote?q=ping", {
    headers: { "X-AgentTab-Voucher": await voucherHeader(price) },
  });
  assert.equal(first.status, 200);
  const paid = await first.json();
  assert.equal(paid.quote.service, "agenttab-portaldot");
  assert.equal(paid.quote.echo, "ping");
  assert.equal(paid.quote.chainId, 420420777);
  assert.equal(paid.payment.rail, "agenttab");
  assert.equal(paid.payment.cumulativeWei, price.toString());
  assert.equal(paid.payment.payer, payer.address);
  assert.equal(paid.payment.settle.status, "pending");

  const replay = await app.request("http://127.0.0.1/quote", {
    headers: { "X-AgentTab-Voucher": await voucherHeader(price) },
  });
  assert.equal(replay.status, 402);
  assert.equal((await replay.json()).error, "stale");
});

test("the Nth accepted voucher is handed to the chain port for settle", async () => {
  const { chain } = seed();
  chain.settleTx = `0x${"12".repeat(32)}` as Hex;
  const app = appFor(chain, 2);
  const first = await app.request("http://127.0.0.1/quote", {
    headers: { "X-AgentTab-Voucher": await voucherHeader(price * 2n) },
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).payment.settle.status, "pending");

  const second = await app.request("http://127.0.0.1/quote", {
    headers: { "X-AgentTab-Voucher": await voucherHeader(price * 3n) },
  });
  assert.equal(second.status, 200);
  const body = await second.json();
  assert.equal(body.payment.settle.status, "submitted");
  assert.equal(body.payment.settle.tx, chain.settleTx);
  assert.equal(chain.settlements.length, 1);
  assert.equal(chain.settlements[0]?.cumulative, price * 3n);
});

test("bad signature, unknown tab, and malformed header stay on 402", async () => {
  const { chain } = seed();
  const app = appFor(chain);
  const other = privateKeyToAccount(generatePrivateKey());
  const badSig = await signVoucher(other, { tabId: 1n, cumulative: price });
  const bad = await app.request("http://127.0.0.1/quote", {
    headers: { "X-AgentTab-Voucher": encodeVoucherHeader({ tabId: 1n, cumulative: price, signature: badSig }) },
  });
  assert.equal(bad.status, 402);
  assert.equal((await bad.json()).error, "bad_signature");

  const missing = await app.request("http://127.0.0.1/quote", {
    headers: { "X-AgentTab-Voucher": await voucherHeader(price).then((h) => h.replace('"tabId":"1"', '"tabId":"99"')) },
  });
  // replacing tabId invalidates the signature (signed over tab 1) AND the tab is missing.
  // economic no_tab is reported before the signature check.
  assert.equal(missing.status, 402);
  assert.equal((await missing.json()).error, "no_tab");

  const malformed = await app.request("http://127.0.0.1/quote", {
    headers: { "X-AgentTab-Voucher": "{" },
  });
  assert.equal(malformed.status, 402);
  assert.equal((await malformed.json()).error, "malformed_voucher");
});

test("GET /quote can be read from the static dashboard origin", async () => {
  const { chain } = seed();
  const app = appFor(chain);
  const res = await app.request("http://127.0.0.1/quote", {
    headers: { Origin: "http://127.0.0.1:4173" },
  });
  assert.equal(res.status, 402);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("access-control-expose-headers") ?? "", /X-AgentTab-Required/);

  const preflight = await app.request("http://127.0.0.1/quote", {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:4173",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "X-AgentTab-Voucher",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /X-AgentTab-Voucher/);
});

test("config defaults to memory mode and does not require a key", () => {
  const cfg = configFromEnv({});
  assert.equal(cfg.mode, "memory");
  assert.equal(cfg.priceWei, price);
  assert.equal(cfg.providerKey, undefined);
  assert.equal(cfg.agentTab, "0x9a096C216f79e08C2DB95d92F412697D8F1f9329");
  assert.throws(() => configFromEnv({ CHAIN_MODE: "rpc" }), /PROVIDER_ADDRESS/);
});

test("listening socket returns 402 for an unpaid quote", async () => {
  const { chain } = seed();
  const app = appFor(chain);
  const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
  try {
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    assert.equal(typeof address, "object");
    if (!address || typeof address === "string") throw new Error("no port");
    const res = await fetch(`http://127.0.0.1:${address.port}/quote`);
    assert.equal(res.status, 402);
    const body = await res.json();
    assert.equal(body.rail, "agenttab");
    assert.equal(body.accept.chainId, 420420777);
  } finally {
    const httpServer = server as { closeAllConnections?: () => void; close(callback?: (err?: Error) => void): void };
    httpServer.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
  }
});
