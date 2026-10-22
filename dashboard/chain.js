/**
 * Browser-side reads for AgentTab. Selectors match `agentTabAbi` in sdk/src/abi.ts
 * (checked by sdk/test/dashboard-abi.test.ts). `nextId()` is the Solidity public
 * getter; that function is not listed in the hand-written ABI.
 * No key, no bundled client. The page talks to the public testnet RPC.
 */

export const CHAIN_ID = 420420777;

export const RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";

export const EXPLORER_URL = "https://node-console.portaldot.dev";

/** Checksummed deployment address. Same constant as sdk `AGENT_TAB_PORTALDOT_TESTNET`. */
export const AGENT_TAB = "0x9a096C216f79e08C2DB95d92F412697D8F1f9329";

export const NATIVE = "0x0000000000000000000000000000000000000000";

export const TABS_SELECTOR = "0x426f8e93";

export const REMAINING_SELECTOR = "0x0361bf14";

export const NEXT_ID_SELECTOR = "0x61b8ce8c";

export const OPENED_TOPIC = "0xdd6b33101c067cc9c2d639fc44ead2f46e100522fca5c21545555409730b067e";

export const SETTLED_TOPIC = "0x321f57f44af402708b8b3bad0bd10012cd568d8696946e26edeb86178bb7c27e";

export const WEI_PER_TPOT = 10n ** 18n;

export const WEI_PER_PLANCK = 10_000n;

export const EVM_DECIMALS = 18;

/** Hashes recorded in this repo. Labels only — never treat these rows as a balance. */
export const RECORDED_TXS = Object.freeze([
  {
    label: "Deploy AgentTab",
    hash: "0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72",
    source: "deployments/portaldot-testnet.json",
    tabId: null,
  },
  {
    label: "Fund demo provider",
    hash: "0xc12b93e4bc199bf3e9bc53e57e4439862b5267d379b3c9310efc8aa91866f59c",
    source: "deployments/portaldot-testnet.json",
    tabId: null,
  },
  {
    label: "open tab 1",
    hash: "0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e",
    source: "deployments/portaldot-testnet.json",
    tabId: 1,
  },
  {
    label: "settle tab 1",
    hash: "0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b",
    source: "deployments/portaldot-testnet.json",
    tabId: 1,
  },
  {
    label: "open tab 2",
    hash: "0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886",
    source: "runs/gateway-sdk-live-20261023.json",
    tabId: 2,
  },
  {
    label: "settle tab 2",
    hash: "0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99",
    source: "runs/gateway-sdk-live-20261023.json",
    tabId: 2,
  },
]);

export const MAX_LISTED_TABS = 40;

export function uint256Word(value) {
  const n = typeof value === "bigint" ? value : BigInt(value);
  if (n < 0n) throw new Error("uint256 is negative");
  const hex = n.toString(16);
  if (hex.length > 64) throw new Error("uint256 overflow");
  return hex.padStart(64, "0");
}

export function tabsCalldata(id) {
  return TABS_SELECTOR + uint256Word(id);
}

export function remainingCalldata(id) {
  return REMAINING_SELECTOR + uint256Word(id);
}

export function parseTabId(raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw new Error("Tab id must be a non-negative integer");
  const id = BigInt(text);
  if (id >= 2n ** 256n) throw new Error("Tab id does not fit in uint256");
  return id;
}

/** Format wei as a tPOT decimal string. Same truncation rules as sdk `formatTpot`. */
export function formatTpot(wei, maxFrac = 6) {
  if (wei < 0n) throw new Error("wei is negative");
  if (maxFrac < 0 || maxFrac > EVM_DECIMALS) throw new Error("maxFrac out of range");
  const whole = wei / WEI_PER_TPOT;
  const fracFull = (wei % WEI_PER_TPOT).toString().padStart(EVM_DECIMALS, "0").slice(0, maxFrac);
  const frac = fracFull.replace(/0+$/, "");
  return frac.length ? `${whole.toString()}.${frac}` : whole.toString();
}

export function isNativeToken(token) {
  return String(token).toLowerCase() === NATIVE;
}

export function decodeUint256(data) {
  if (typeof data !== "string" || !/^0x[0-9a-fA-F]*$/.test(data) || data.length < 3) {
    throw new Error("RPC returned no uint word");
  }
  return BigInt(data);
}

function wordAt(hex, index) {
  const start = index * 64;
  const word = hex.slice(start, start + 64);
  if (word.length !== 64) throw new Error("RPC word is short");
  return word;
}

function addressFromWord(word) {
  return "0x" + word.slice(24);
}

/**
 * Decode `tabs(id)`. A zero payer means that id was never opened.
 * @returns {null | { payer: string, provider: string, token: string, deposit: bigint, claimed: bigint, expiry: bigint }}
 */
export function decodeTab(data) {
  if (typeof data !== "string" || !data.startsWith("0x")) throw new Error("RPC returned no tab");
  const hex = data.slice(2);
  if (hex.length === 0) return null;
  if (hex.length < 64 * 6) throw new Error("tabs() return is short");
  const payer = addressFromWord(wordAt(hex, 0));
  if (isNativeToken(payer)) return null;
  return {
    payer,
    provider: addressFromWord(wordAt(hex, 1)),
    token: addressFromWord(wordAt(hex, 2)),
    deposit: BigInt("0x" + wordAt(hex, 3)),
    claimed: BigInt("0x" + wordAt(hex, 4)),
    expiry: BigInt("0x" + wordAt(hex, 5)),
  };
}

function topicAddress(topic) {
  if (typeof topic !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(topic)) throw new Error("bad indexed address");
  return "0x" + topic.slice(-40);
}

export function parseOpenedLog(log) {
  if (!log || !Array.isArray(log.topics) || log.topics.length < 4) throw new Error("Opened log is missing topics");
  const data = String(log.data || "").slice(2);
  if (data.length < 64 * 3) throw new Error("Opened log data is short");
  return {
    id: BigInt(log.topics[1]),
    payer: topicAddress(log.topics[2]),
    provider: topicAddress(log.topics[3]),
    token: addressFromWord(wordAt(data, 0)),
    amount: BigInt("0x" + wordAt(data, 1)),
    expiry: BigInt("0x" + wordAt(data, 2)),
    transactionHash: String(log.transactionHash || ""),
    blockNumber: BigInt(log.blockNumber),
  };
}

export function parseSettledLog(log) {
  if (!log || !Array.isArray(log.topics) || log.topics.length < 2) throw new Error("Settled log is missing topics");
  const data = String(log.data || "").slice(2);
  if (data.length < 64 * 2) throw new Error("Settled log data is short");
  return {
    id: BigInt(log.topics[1]),
    paid: BigInt("0x" + wordAt(data, 0)),
    cumulative: BigInt("0x" + wordAt(data, 1)),
    transactionHash: String(log.transactionHash || ""),
    blockNumber: BigInt(log.blockNumber),
  };
}

export function listedIds(nextId) {
  if (nextId <= 1n) return [];
  const last = nextId - 1n;
  const start = last > BigInt(MAX_LISTED_TABS) ? last - BigInt(MAX_LISTED_TABS) + 1n : 1n;
  const ids = [];
  for (let id = start; id <= last; id += 1n) ids.push(id);
  return ids;
}

export async function rpcRequest(url, method, params, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) {
    const message = body.error.message || "RPC error";
    throw new Error(message);
  }
  return body.result;
}

export function isLoopbackUrl(value) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}
