import { Hono } from "hono";
import { getAddress, type Address, type Hex } from "viem";
import {
  AGENT_TAB_PORTALDOT_TESTNET,
  NATIVE,
  PORTALDOT_V3_CHAIN_ID,
  VOUCHER_HEADER,
  WEI_PER_PLANCK,
  decodeVoucherHeader,
  evaluateVoucher,
  paymentChallenge,
  type TabState,
} from "agenttab-portaldot-sdk";
import type { ChainPort } from "./memory.js";

export type GatewayOptions = {
  provider: Address;
  chain: ChainPort;
  priceWei?: bigint;
  agentTab?: Address;
  chainId?: number;
  settleEvery?: number;
  now?: () => bigint;
  nativeOnly?: boolean;
};

export type QuoteBody = {
  service: "agenttab-portaldot";
  resource: string;
  echo: string | null;
  chainId: number;
};

const DEFAULT_PRICE = 10n ** 14n;

function challengeHeader(opts: { chainId: number; agentTab: Address; provider: Address }): string {
  return `agenttab; chain=${opts.chainId}; contract=${opts.agentTab}; payTo=${opts.provider}`;
}

export function createGateway(options: GatewayOptions) {
  const priceWei = options.priceWei ?? DEFAULT_PRICE;
  if (priceWei <= 0n) throw new Error("price must be positive");
  if (priceWei % WEI_PER_PLANCK !== 0n) {
    throw new Error("priceWei must be a multiple of 10000 wei so it maps to integer tPOT planck");
  }
  const agentTab = options.agentTab ?? AGENT_TAB_PORTALDOT_TESTNET;
  const chainId = options.chainId ?? PORTALDOT_V3_CHAIN_ID;
  const provider = getAddress(options.provider);
  const settleEvery = options.settleEvery ?? 5;
  if (!Number.isInteger(settleEvery) || settleEvery < 1) throw new Error("settleEvery must be a positive integer");
  const now = options.now ?? (() => BigInt(Math.floor(Date.now() / 1000)));
  const accepted = new Map<string, bigint>();
  const counts = new Map<string, number>();

  const offer = () =>
    paymentChallenge({ provider, priceWei, agentTab, chainId });

  const app = new Hono();

  // The static dashboard (another origin, often GitHub Pages or localhost:4173)
  // probes GET /quote. No cookies are used, so a wildcard allow-origin is enough.
  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Origin", "*");
      c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type, X-AgentTab-Voucher");
      c.header("Access-Control-Max-Age", "600");
      return c.body(null, 204);
    }
    await next();
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Expose-Headers", "X-AgentTab-Required");
  });

  app.get("/health", (c) => c.json({ ok: true, rail: "agenttab", chainId }));

  app.get("/config", (c) =>
    c.json({
      chainId,
      agentTab,
      provider,
      priceWei: priceWei.toString(),
      token: NATIVE,
      symbol: "tPOT",
      settleEvery,
      header: VOUCHER_HEADER,
    }),
  );

  app.get("/quote", async (c) => {
    const required = challengeHeader({ chainId, agentTab, provider });
    const raw = c.req.header(VOUCHER_HEADER) ?? c.req.header("x-agenttab-voucher");
    if (!raw) {
      c.header("X-AgentTab-Required", required);
      return c.json(offer(), 402);
    }

    let voucher;
    try {
      voucher = decodeVoucherHeader(raw);
    } catch {
      c.header("X-AgentTab-Required", required);
      return c.json({ ...offer(), error: "malformed_voucher" }, 402);
    }

    let tab: TabState | null;
    try {
      tab = await options.chain.readTab(voucher.tabId);
    } catch {
      return c.json({ error: "tab_lookup_failed", chainId, agentTab }, 503);
    }

    const key = voucher.tabId.toString();
    const remembered = accepted.get(key) ?? 0n;
    const claimed = tab?.claimed ?? 0n;
    const baseline = remembered > claimed ? remembered : claimed;
    const decision = await evaluateVoucher({
      voucher,
      tab,
      expectedProvider: provider,
      priceWei,
      baseline,
      now: now(),
      verifyingContract: agentTab,
      chainId,
      nativeOnly: options.nativeOnly ?? true,
    });
    if (!decision.ok) {
      c.header("X-AgentTab-Required", required);
      return c.json({ ...offer(), error: decision.error }, 402);
    }

    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    accepted.set(key, decision.cumulative);

    let settle:
      | { status: "submitted"; tx: Hex }
      | { status: "recorded" }
      | { status: "pending"; until: number }
      | { status: "error"; message: string };
    if (n % settleEvery === 0 && options.chain.settle) {
      try {
        const tx = await options.chain.settle({
          id: voucher.tabId,
          cumulative: decision.cumulative,
          signature: voucher.signature,
        });
        settle = tx ? { status: "submitted", tx } : { status: "recorded" };
      } catch (err) {
        settle = { status: "error", message: err instanceof Error ? err.message : "settle failed" };
      }
    } else {
      settle = { status: "pending", until: settleEvery - (n % settleEvery) };
    }

    const quote: QuoteBody = {
      service: "agenttab-portaldot",
      resource: "/quote",
      echo: c.req.query("q") ?? null,
      chainId,
    };
    return c.json({
      quote,
      payment: {
        rail: "agenttab",
        tabId: key,
        payer: decision.payer,
        cumulativeWei: decision.cumulative.toString(),
        deltaWei: decision.delta.toString(),
        accepted: n,
        settle,
      },
    });
  });

  return app;
}
