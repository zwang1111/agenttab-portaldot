import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getAddress, zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  AGENT_TAB_PORTALDOT_TESTNET,
  NATIVE,
  PORTALDOT_V3_CHAIN_ID,
  agentTabDomain,
  decodeVoucherHeader,
  digestVoucher,
  encodeVoucherHeader,
  evaluateVoucher,
  paymentChallenge,
  signVoucher,
  typedDataHash,
  type TabState,
} from "../src/index.ts";

const deployment = JSON.parse(readFileSync(new URL("../../deployments/portaldot-testnet.json", import.meta.url), "utf8")) as {
  chainId: number;
  rpc: string;
  contracts: { AgentTab: { address: string } };
};

test("sdk chain config matches the recorded Portaldot deployment", () => {
  assert.equal(PORTALDOT_V3_CHAIN_ID, deployment.chainId);
  assert.equal(AGENT_TAB_PORTALDOT_TESTNET, getAddress(deployment.contracts.AgentTab.address));
  assert.equal(deployment.chainId, 420420777);
});

test("manual Solidity digest matches viem EIP-712 hash on chain 420420777", () => {
  const domain = agentTabDomain(AGENT_TAB_PORTALDOT_TESTNET, PORTALDOT_V3_CHAIN_ID);
  const digest = digestVoucher(1n, 10n ** 16n, domain);
  assert.equal(digest, typedDataHash(1n, 10n ** 16n, domain));
  assert.notEqual(digest, digestVoucher(1n, 10n ** 16n, agentTabDomain(AGENT_TAB_PORTALDOT_TESTNET, 42220)));
});

test("sign and recover a voucher for the deployed contract", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const cumulative = 10n ** 14n;
  const signature = await signVoucher(account, { tabId: 1n, cumulative });
  assert.match(signature, /^0x[0-9a-f]{130}$/);
  const tab: TabState = {
    payer: account.address,
    provider: getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    token: NATIVE,
    deposit: 10n ** 18n,
    claimed: 0n,
    expiry: 2_000_000_000n,
  };
  const ok = await evaluateVoucher({
    voucher: { tabId: 1n, cumulative, signature },
    tab,
    expectedProvider: tab.provider,
    priceWei: cumulative,
    baseline: 0n,
    now: 1_700_000_000n,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.delta, cumulative);
});

test("rejects a voucher signed by someone other than the payer", async () => {
  const payer = privateKeyToAccount(generatePrivateKey());
  const stranger = privateKeyToAccount(generatePrivateKey());
  const signature = await signVoucher(stranger, { tabId: 1n, cumulative: 10n ** 14n });
  const decision = await evaluateVoucher({
    voucher: { tabId: 1n, cumulative: 10n ** 14n, signature },
    tab: {
      payer: payer.address,
      provider: payer.address,
      token: NATIVE,
      deposit: 10n ** 18n,
      claimed: 0n,
      expiry: 2_000_000_000n,
    },
    expectedProvider: payer.address,
    priceWei: 10n ** 14n,
    baseline: 0n,
    now: 1n,
  });
  assert.deepEqual(decision, { ok: false, error: "bad_signature" });
});

test("economic checks: stale, below price, exceeds, expired, wrong provider, erc20", async () => {
  const payer = privateKeyToAccount(generatePrivateKey());
  const provider = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const price = 10n ** 14n;
  const sign = (cumulative: bigint) => signVoucher(payer, { tabId: 7n, cumulative });
  const base: TabState = {
    payer: payer.address,
    provider,
    token: NATIVE,
    deposit: price * 3n,
    claimed: 0n,
    expiry: 100n,
  };
  const run = async (patch: Partial<TabState>, cumulative: bigint, baseline: bigint, now = 1n, expected = provider) =>
    evaluateVoucher({
      voucher: { tabId: 7n, cumulative, signature: await sign(cumulative) },
      tab: { ...base, ...patch },
      expectedProvider: expected,
      priceWei: price,
      baseline,
      now,
    });

  const expectError = async (decision: Promise<{ ok: boolean; error?: string }>, error: string) => {
    const result = await decision;
    assert.equal(result.ok, false);
    assert.equal(result.error, error);
  };
  await expectError(run({}, price, price), "stale");
  await expectError(run({}, price / 2n, 0n), "below_price");
  await expectError(run({}, price * 4n, 0n), "exceeds_deposit");
  await expectError(run({}, price, 0n, 100n), "expired");
  await expectError(run({}, price, 0n, 1n, payer.address), "wrong_provider");
  await expectError(run({ token: getAddress("0x00000000000000000000000000000000000000c0") }, price, 0n), "unsupported_token");
  await expectError(
    evaluateVoucher({
      voucher: { tabId: 7n, cumulative: price, signature: await sign(price) },
      tab: null,
      expectedProvider: provider,
      priceWei: price,
      baseline: 0n,
      now: 1n,
    }),
    "no_tab",
  );
});

test("voucher header round-trips JSON and base64url", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const signature = await signVoucher(account, { tabId: 4n, cumulative: 10n ** 14n });
  const header = encodeVoucherHeader({ tabId: 4n, cumulative: 10n ** 14n, signature });
  assert.deepEqual(decodeVoucherHeader(header), { tabId: 4n, cumulative: 10n ** 14n, signature });
  const b64 = Buffer.from(header, "utf8").toString("base64url");
  assert.deepEqual(decodeVoucherHeader(b64), { tabId: 4n, cumulative: 10n ** 14n, signature });
  assert.throws(() => decodeVoucherHeader("{"), /malformed/);
});

test("402 challenge is the AgentTab rail on Portaldot, priced in native tPOT", () => {
  const body = paymentChallenge({
    provider: getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    priceWei: 10n ** 14n,
  });
  assert.equal(body.rail, "agenttab");
  assert.equal(body.accept.chainId, 420420777);
  assert.equal(body.accept.network, "eip155:420420777");
  assert.equal(body.accept.contract, AGENT_TAB_PORTALDOT_TESTNET);
  assert.equal(body.accept.token, zeroAddress);
  assert.equal(body.price.symbol, "tPOT");
  assert.equal(body.price.substrateDecimals, 14);
  assert.equal(body.price.evmDecimals, 18);
  assert.equal(body.price.amountTpot, "0.0001");
  assert.equal(body.accept.voucher.domain.name, "AgentTab");
  assert.equal(body.accept.open.payable, true);
  const blob = JSON.stringify(body).toLowerCase();
  assert.equal(blob.includes("x402"), false);
  assert.equal(blob.includes("usat"), false);
  assert.equal(blob.includes("facilitator"), false);
});
