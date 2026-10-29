# Final demo runbook — judges

Use this on the day. It does not send a transaction and it does not need a private key. Every hash below is already in [`DEPLOYMENT.md`](../DEPLOYMENT.md) or [`runs/gateway-sdk-live-20261023.json`](../runs/gateway-sdk-live-20261023.json).

BUIDL: https://dorahacks.io/buidl/50150  
Repo: https://github.com/zwang1111/agenttab-portaldot

Timebox: about five minutes. Order: unpaid HTTP 402, then the dashboard, then paste two hashes into the node console.

**Public final demo video (real product screen-record):** [`docs/demo-final.mp4`](demo-final.mp4) — dashboard + HTTP 402 + settle hash proof slide (~≤3 min).

- Path: `docs/demo-final.mp4`
- Raw: https://raw.githubusercontent.com/zwang1111/agenttab-portaldot/main/docs/demo-final.mp4
- Blob: https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/demo-final.mp4

Week 2 [`docs/demo-checkin.mp4`](demo-checkin.mp4) remains title cards only — do not play it as the product demo.

## 0. On screen before you start

- Repo README, this file, or the pitch — not `.env`.
- Node console: https://node-console.portaldot.dev
- That site has **no per-transaction page**. Path the judges will see: open the console, **Network → events**, paste a hash from the table below.

Contract to say out loud: `0x9a096C216f79e08C2DB95d92F412697D8F1f9329` on chain `420420777`.

## 1. Gateway 402 (no key, no RPC)

From a fresh shell at the repo root:

```bash
npm install
npm test
npm run dry-run
```

`npm run dry-run` binds a random local port, prints a 402 for chain `420420777` and the deployed contract, then one paid call and a 402 replay. The key exists only in that process.

Leave a second terminal on the default gateway:

```bash
npm run gateway
```

Expect a log line with `"msg":"agenttab gateway"`, `"port":8402`, `"mode":"memory"`, `"chainId":420420777`, `"agentTab":"0x9a096C216f79e08C2DB95d92F412697D8F1f9329"`. Memory mode does not submit a transaction. Settle stays off because no `PROVIDER_PK` is set.

```bash
curl -i http://127.0.0.1:8402/quote
```

Show the judges these fields in the response:

- Status **402** and header `X-AgentTab-Required`
- `"error": "payment_required"`
- `"rail": "agenttab"`
- `"price.amountWei": "100000000000000"` (`0.0001` tPOT)
- `"accept.network": "eip155:420420777"`
- `"accept.chainId": 420420777`
- `"accept.contract": "0x9a096C216f79e08C2DB95d92F412697D8F1f9329"`
- `"accept.token": "0x0000000000000000000000000000000000000000"` (native tPOT)

That is the whole unpaid offer. Stop there unless you are on the funded machine that already produced tab #2. Do not create a new tab during the judging slot.

## 2. Dashboard

One-click, no install. Checked **HTTP 200** on 2026-10-29:

https://zwang1111.github.io/agenttab-portaldot/

That host is the dashboard. [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) uploads the `dashboard/` directory, so the site root is the inspector (`dashboard/index.html` in the repo). Open the URL above with nothing after the host. The path `/dashboard/` on this host is HTTP 404 by design: the published artifact has no nested `dashboard/` folder. Do not add that segment.

Same files on the presenter's machine (use this if you also want the 402 probe button against a gateway on that machine):

```bash
npm run dashboard
```

Open http://127.0.0.1:4173

Spare copy, also HTTP 200 on 2026-10-29, and not the Pages site: [htmlpreview of `dashboard/index.html`](https://htmlpreview.github.io/?https://github.com/zwang1111/agenttab-portaldot/blob/main/dashboard/index.html).

What to click:

1. Wait until the status line is no longer "This page has not read the chain yet." Rows come from `tabs(id)` / `remaining(id)` on `https://test-evm-rpc-v3.portaldot.dev`. If the RPC is quiet, the table stays empty — do not type a balance in.
2. Select **tab 1**. Say: native tPOT, deposit `0.01` tPOT (`1e16` wei), claimed half, remaining `5e15` wei (`0.005` tPOT) after the check-in settle. Provider `0x7F220d4db849E7Ee220f9F8fdD99fc016b3F3369`. Expiry in the deployment record is `1792681392` (2026-10-22T15:03:12Z). On 2026-10-29 the badge is **Expired**. Remaining is still the unspent escrow.
3. Select **tab 2**. Say: gateway + SDK live demo on 2026-10-23, deposit `0.01` tPOT, one paid call settled `0.0001` tPOT (`1e14` wei), remaining `0.0099` tPOT. Payer and provider were both the deployer `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` so settle did not need a second key. An `eth_call` of `tabs(2)` on 2026-10-29 returned expiry `1792774691` (2026-10-23T16:58:11Z), so this badge is **Expired** too.
4. Scroll to **Recorded in the repository** and point at the open/settle rows. Those hashes are labels from git, not a second balance.
5. Optional, only if `npm run gateway` is running on **this** machine: press **Probe /quote**. The field must stay `http://127.0.0.1:8402/quote`. The page refuses any non-loopback URL. From the public github.io page, localhost is the viewer's own computer, so skip the probe unless the gateway is running there and use the `curl` from step 1.

## 3. Hashes to paste for judges

Explorer: https://node-console.portaldot.dev → **Network → events** → paste one hash.

Show these two if you are short on time. They are the product, not the deploy:

| Say this | Hash | Where it is written down |
|---|---|---|
| Gateway live **open tab #2** | `0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886` | `DEPLOYMENT.md`, `runs/gateway-sdk-live-20261023.json` (block 148648) |
| Gateway live **settle tab #2** | `0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99` | same (block 148651, cumulative `1e14` wei) |

Show these if a judge asks for the original escrow:

| Say this | Hash |
|---|---|
| Deploy AgentTab | `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72` |
| Open tab #1 (native tPOT, deposit `1e16` wei) | `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e` |
| Settle tab #1 (cumulative `5e15` wei) | `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b` |

Provider funded for tab #1 gas (only if asked): `0xc12b93e4bc199bf3e9bc53e57e4439862b5267d379b3c9310efc8aa91866f59c`.

Deployer H160: `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd`.

## 4. Substrate, if they ask

Do not claim a signed extrinsic.

```bash
npm run revive-probe
```

That reads the public testnet and rewrites `runs/revive-probe.json`. It does not sign. The copy already in git is enough if the network is awkward:

- `submitted` is `false`
- `blockNumber` is `148951`
- `agentTab.remaining.ethCall` and `reviveApi` are both `5000000000000000` (`match: true`)
- `settleDryRun.errorName` is `NotProvider` (`0x3480e2b2`) — the origin is tab #1's payer, not its provider. The contract ran. Nothing settled.
- `agentTab.reviveCallHex` is unsigned SCALE for pallet 80, call 1. Not submitted.
- Fallback account (public): `5Fe78D5g5NcrMU2J97UXdQEMU1DSNwgh7knaHirpD8J8th3U`

A signed `Revive.call` is optional and is still open. See [`STATUS.md`](../STATUS.md).

## 5. What you are not demoing

- A new on-chain tab. Tab #1 and tab #2 are the evidence.
- The Celo x402 facilitator. This repo does not ship it. `src/AgentTab.sol` is the MIT AgentTab port from [agenttab-celo](https://github.com/zwang1111/agenttab-celo) (2026-10-15).
- The DoraHacks final form. It requires the entrant to be logged in at https://dorahacks.io/buidl/50150. Have that session open in another profile if the form itself is in the slot.
- Week 2 `docs/demo-checkin.mp4` as a product recording (title cards only). Use `docs/demo-final.mp4` instead.

## If the RPC or the console is down

`npm run dry-run` still proves the 402 on the laptop. Then read the hashes from `DEPLOYMENT.md` out loud and show `runs/gateway-sdk-live-20261023.json`. Say the dashboard stays empty when the RPC does not answer, which is intentional.
