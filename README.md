# AgentTab on Portaldot V3 — pay-per-call payment tabs for AI agents

AI agents can't manage subscriptions or API keys, but they can pay. **AgentTab** lets an agent escrow
native **tPOTv3/POT** (or any ERC-20 on Portaldot) for an API provider once, then sign an **EIP-712 voucher**
with the new cumulative amount on every call. The provider batch-settles many calls in one transaction,
and the agent reclaims the unspent balance after expiry. It runs as a Solidity contract on Portaldot V3's
EVM-compatible execution layer (pallet-revive).

The provider in this repo sells calls over **HTTP 402**. The only rail in the challenge is AgentTab on
chain `420420777`. There is no x402 facilitator and no stablecoin asset — see [Reuse disclosure](#reuse-disclosure).

## Live demo

The inspector reads the deployed contract from the public RPC. It does not ask for a key.

**One-click (HTTP 200 on 2026-10-29):** [AgentTab inspector](https://htmlpreview.github.io/?https://github.com/zwang1111/agenttab-portaldot/blob/main/dashboard/index.html)

That link is htmlpreview in front of the repo path `dashboard/index.html` on `main`. The page script is classic `dashboard/browser.js`, which is what that previewer can run. Checked 2026-10-29: the URL returned HTTP 200, and the same previewer pointed at the commit that adds `browser.js` read tab #1 and tab #2 from the public RPC.

**GitHub Pages is not a demo link yet.** These returned **HTTP 404** on 2026-10-29, and the token cannot enable the site (`POST /pages` → 403):

- https://zwang1111.github.io/agenttab-portaldot/
- https://zwang1111.github.io/agenttab-portaldot/dashboard/
- https://zwang1111.github.io/agenttab-portaldot/dashboard/index.html

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `dashboard/` after an admin sets **Settings → Pages → Source → GitHub Actions** and a later GET returns 200. Until then, do not send judges to github.io.

**On the presenter's machine:** `npm run dashboard` → http://127.0.0.1:4173

Judge script, including which hashes to paste: [`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md). Snapshot: [`STATUS.md`](STATUS.md).

## Product architecture

```mermaid
sequenceDiagram
    participant A as Agent SDK
    participant G as Provider gateway
    participant C as AgentTab.sol (Portaldot V3 EVM)
    A->>G: GET /quote
    G-->>A: 402 price + AgentTab domain (eip155:420420777, native tPOT)
    A->>C: open{value: tPOT}(provider, address(0), deposit, expiry)
    loop every API call
        A->>G: GET /quote + X-AgentTab-Voucher (tabId, cumulative)
        G-->>A: 200 quote, or 402 if the voucher is stale or invalid
    end
    G->>C: settle(tabId, cumulative, sig)  (one tx per N calls)
    C-->>G: pays cumulative - claimed in tPOT
    A->>C: refund(tabId) after expiry
```

Component notes, the 14-decimal / 18-decimal split, and the voucher checks: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

The same bytecode is also reachable from a native Substrate account. `ReviveApi_call` is the dry-run; `Revive.call` (pallet 80, call 1) is the extrinsic. No second contract.

```mermaid
flowchart LR
  EVM["EVM JSON-RPC"] --> REV["pallet-revive"]
  ACC["Substrate account 5…"] --> REV
  REV --> TAB["AgentTab.sol"]
  TAB --> POT["native tPOT"]
  TAB --> PRE["optional Assets ERC-20\nprefix 0x0001"]
```

## Status (2026-10-29, Asia/Shanghai)

Snapshot and the freeze plan: [`STATUS.md`](STATUS.md). BUIDL: https://dorahacks.io/buidl/50150

- Contract ported and tested: `forge test` → 7 passing (ERC-20 tabs, native tabs, bad sig, stale, exceeds, refund, top-up).
- **Deployed on Portaldot V3 testnet** (chain `420420777`):
  - AgentTab: `0x9a096C216f79e08C2DB95d92F412697D8F1f9329`
  - Deploy tx: `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`
  - Demo open: `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e`
  - Demo settle: `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b` (native tPOT tab #1)
- **Gateway + SDK are live** (`gateway/`, `sdk/`): unpaid `GET /quote` returns 402; a signed voucher is verified locally. `npm test` and `npm run dry-run` need no RPC and no key. **Testnet demo 2026-10-23:** open tab #2 `0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886`, settle `0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99` ([`DEPLOYMENT.md`](DEPLOYMENT.md)).
- **Substrate ReviveApi probes** (`substrate/`): `ReviveApi_call` from the deployer's public fallback account `5Fe78…` reads `remaining(1) == 5e15`, matching `eth_call`, at block 148951 in [`runs/revive-probe.json`](runs/revive-probe.json). A `settle` dry-run reverts `NotProvider`. Unsigned `Revive.call` bytes are in that file. No signed Substrate extrinsic was submitted.
- **Dashboard is on `main`** ([`dashboard/`](dashboard/)): static tab inspector. `npm run dashboard` serves it with no key. Remaining, provider, and expiry come from the public RPC.
- **Check-in assets in tree:** [`docs/demo-checkin.mp4`](docs/demo-checkin.mp4) (static cards, not a product recording) and [`docs/pitch.pdf`](docs/pitch.pdf) / [`docs/pitch.html`](docs/pitch.html).
- Full addresses, hashes, and explorer notes: [`DEPLOYMENT.md`](DEPLOYMENT.md) / [`deployments/portaldot-testnet.json`](deployments/portaldot-testnet.json).
- DoraHacks check-in paste (historical, Oct 24): [`CHECKIN.md`](CHECKIN.md).

## Plan (freeze 2026-11-06 12:00 Asia/Shanghai)

No bulk core commits after **2026-11-05 12:00 Asia/Shanghai**. Prefer docs and config over new product surface. Still open:

- A **real product demo video**. The check-in file is static cards.
- A **hosted dashboard URL**. GitHub Pages is the intended host and is not enabled; github.io was HTTP 404 on 2026-10-29. Interim one-click link is the htmlpreview URL above.
- The **DoraHacks final form**, which is user-login at https://dorahacks.io/buidl/50150. This repository cannot submit it.
- Optional: a **signed** Substrate `Revive.call` extrinsic. The unsigned probe is already recorded.

How to present what is already on-chain: [`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md).

## Network
| | |
|---|---|
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` (chain ID `420420777`) |
| Substrate RPC | `wss://test-node-v3.portaldot.dev` (chain "PortaldotV3 Test", SS58 42) |
| Token | `tPOTv3`, 14 decimals on Substrate, 18-decimal wei on the EVM RPC (`1 planck = 10_000 wei`) |
| Explorer | https://node-console.portaldot.dev |
| AgentTab | `0x9a096C216f79e08C2DB95d92F412697D8F1f9329` |
| Deployer | `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` |

## Run the gateway (no key, no RPC)

```bash
npm install
npm test          # 402 challenge, voucher accept/reject, open calldata
npm run dry-run   # binds a local port, prints 402 then one paid call
npm run gateway   # GET http://127.0.0.1:8402/quote → 402
```

`npm run gateway` defaults to `CHAIN_MODE=memory`. It answers the 402 from the deployed contract's domain and does not submit transactions. The paid path in CI uses an in-memory tab (`gateway/test`, `npm run dry-run`).

Unpaid response (truncated):

```json
{
  "error": "payment_required",
  "rail": "agenttab",
  "price": { "amountWei": "100000000000000", "amountTpot": "0.0001", "symbol": "tPOT", "substrateDecimals": 14, "evmDecimals": 18 },
  "accept": { "scheme": "agenttab", "network": "eip155:420420777", "chainId": 420420777, "token": "0x0000000000000000000000000000000000000000" }
}
```

## Dashboard (no key)

[`dashboard/`](dashboard/) is a static inspector. It calls `tabs`, `remaining`, `nextId`, and `Opened` / `Settled` logs on the public EVM RPC from the browser. If the RPC is quiet, the page stays empty instead of filling in a balance. Open and settle hashes link to the [node console](https://node-console.portaldot.dev) (paste the hash under Network → events; that site has no per-transaction route). The same page shows the local `GET /quote` 402 flow and can probe `http://127.0.0.1:8402/quote` when the gateway is running.

```bash
npm run build:dashboard   # only after editing dashboard/chain.js or dashboard/app.js
npm run dashboard
# http://127.0.0.1:4173
```

`dashboard/index.html` loads `dashboard/browser.js`, a classic script generated from `chain.js` and `app.js` (`npm run build:dashboard`). There is no Vite build and no secret. `chain.js` stays an ES module so `npm test` can import it. The classic bundle is what htmlpreview can execute: that previewer skips `type="module"`, and `raw.githubusercontent.com` serves `.js` as `text/plain`.

GitHub Pages, when an admin enables source **GitHub Actions**, serves this same `dashboard/` directory via [`.github/workflows/pages.yml`](.github/workflows/pages.yml). The workflow does not deploy while the Pages API is 404, so a missing site does not fail CI. `npm run gateway` sends `Access-Control-Allow-Origin: *` on `GET /quote`, which is what lets the page read a loopback gateway.

## Run against Portaldot V3 testnet

Use a throwaway key. Put it in `.env` (gitignored) or the environment. Never commit it.
Fund the **mapped SS58 account** (node console → Developer → Runtime calls → reviveApi → accountId). The H160 is not the account that holds tPOT.

```bash
cp .env.example .env
# AGENT_PK, PROVIDER_ADDRESS, optional PROVIDER_PK

# 1. Payer escrows native tPOT (legacy tx, gas = eth_estimateGas)
CHAIN_MODE=rpc AGENT_PK=0x... PROVIDER_ADDRESS=0x... DEPOSIT_TPOT=0.01 npm run open-tab

# 2. Provider verifies vouchers against the live tab and settles every SETTLE_EVERY calls
CHAIN_MODE=rpc PROVIDER_ADDRESS=0x... PROVIDER_PK=0x... npm run gateway

# 3. Payer buys one call (reads claimed via RPC, signs cumulative = claimed + price)
API_BASE=http://127.0.0.1:8402 TAB_ID=1 AGENT_PK=0x... npm run call
```

`open` / `topUp` / `settle` go out as legacy transactions. pallet-revive's `eth_estimateGas` is much larger than an Ethereum gas limit; the SDK passes that estimate through, same as [`scripts/deploy.sh`](scripts/deploy.sh).

Substrate dry-run (no key, reads the public testnet, writes `runs/revive-probe.json`):

```bash
npm run revive-probe
```

Contract-only deploy (no gateway):

```bash
forge test
cp .env.example .env   # throwaway testnet key only; set DEPLOYER_ADDRESS too
scripts/deploy.sh      # refuses to run if unfunded; uses legacy + estimateGas gas-limit
```

### SDK sketch

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  openNativeTab, parseTpot, portaldotV3Testnet, signVoucher, tabIdFromReceipt,
} from "agenttab-portaldot-sdk";

const account = privateKeyToAccount(process.env.AGENT_PK as `0x${string}`);
const transport = http("https://test-evm-rpc-v3.portaldot.dev");
const publicClient = createPublicClient({ chain: portaldotV3Testnet, transport });
const walletClient = createWalletClient({ account, chain: portaldotV3Testnet, transport });

const hash = await openNativeTab(
  { account, publicClient, walletClient },
  { provider: "0x…", depositWei: parseTpot("0.01"), expiry: BigInt(Math.floor(Date.now() / 1000) + 86400) },
);
const tabId = tabIdFromReceipt(await publicClient.waitForTransactionReceipt({ hash }));
const signature = await signVoucher(account, { tabId, cumulative: parseTpot("0.0001") });
```

## Reuse disclosure

`src/AgentTab.sol` is a port of the author's MIT AgentTab contract, written 2026-10-15 for the Celo entry
([agenttab-celo](https://github.com/zwang1111/agenttab-celo)). That repo also sells calls through Celo's x402
facilitator (EIP-3009 USA₮). **This repository does not ship that rail.** `@x402/*`, the facilitator, USA₮
asset config, and ERC-8021 attribution tags are Celo-specific and are not dependencies here.

Portaldot-only code, written for this Hacker House:

- native tPOT tabs in the contract port (`token = address(0)`, payable `open` / `topUp`, `call{value:}` payouts, reentrancy guard)
- `sdk/` — chain `420420777`, 14-decimal planck ↔ 18-decimal wei helpers, EIP-712 sign/verify, legacy gas for pallet-revive
- `gateway/` — HTTP 402 whose body names the AgentTab rail and the deployed testnet contract
- `substrate/` — `ReviveApi_call` / `Revive.call` from an `AccountId32`, and `buildOpenErc20Tab` for the Assets precompile at prefix `0x0001`
- `dashboard/` — static read of the deployed tab via the public RPC, plus the local 402 probe

Dependencies: forge-std (MIT/Apache-2.0), viem (MIT), hono (MIT). The TypeScript packages are MIT. Built with AI assistance (coding agent).
