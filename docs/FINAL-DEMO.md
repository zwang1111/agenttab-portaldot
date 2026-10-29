# Final demo — judge path

**Project:** AgentTab on Portaldot V3 · **BUIDL** 50150 · **Freeze** 2026-11-06

Use this order. Each step points at a file or a transaction that is already in the repo. Commands that talk to the chain are read-only unless you add a throwaway key yourself. Do not put a key in the repo.

中文步骤在文末。

## 1. Open the packet

| Step | Link | What you should see |
|---|---|---|
| Status | [`../STATUS.md`](../STATUS.md) | Shipped vs TODO, with hashes |
| Pitch deck | [`pitch.html`](pitch.html) | Arrow keys / swipe. GitHub blob (HTTP 200 on 2026-10-29): https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/pitch.html |
| Pitch PDF | [`pitch.pdf`](pitch.pdf) | Same deck, printable. Blob: https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/pitch.pdf |
| Week 2 video | [`demo-checkin.mp4`](demo-checkin.mp4) | Title-card walkthrough of the contract deploy / open / settle. Blob: https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/demo-checkin.mp4 |
| BUIDL | https://dorahacks.io/build/50150 | Project id already printed in `docs/DEMO.md` and `pitch.html` |
| Pages entry | [`index.html`](index.html) | Static page for a future `/docs` GitHub Pages source |

**TODO — do not treat these as live:**

- Published GitHub Pages URL. `https://zwang1111.github.io/agenttab-portaldot/` returned 404 on 2026-10-29.
- Hosted final demo video (YouTube, Loom, or similar). The README has no such URL. The mp4 above is the Week 2 check-in cut.
- Public dashboard URL. The only documented address is local `http://127.0.0.1:4173`.

`docs/DEMO.md` describes that Week 2 cut. This file is the freeze path.

## 2. Confirm the three shipped surfaces

### Gateway + SDK settle (on-chain, 2026-10-23)

Recorded in [`../runs/gateway-sdk-live-20261023.json`](../runs/gateway-sdk-live-20261023.json) and [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

| Step | Value |
|---|---|
| Chain | `420420777` · `https://test-evm-rpc-v3.portaldot.dev` |
| Contract | `0x9a096C216f79e08C2DB95d92F412697D8F1f9329` |
| Open tab #2 | `0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886` · deposit `0.01` tPOT · payer = provider = deployer |
| Unpaid quote | HTTP 402, rail `agenttab`, price `0.0001` tPOT (`1e14` wei) |
| Settle | `0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99` · cumulative `1e14` wei · `SETTLE_EVERY=1` |

Node console (paste the hash under Network → events): https://node-console.portaldot.dev

Offline reproduction, no RPC and no key:

```bash
npm install
npm test
npm run dry-run
```

`npm run dry-run` prints a 402, one paid call, then a replay rejected as stale. `npm run gateway` then answers `GET http://127.0.0.1:8402/quote` with 402 in `CHAIN_MODE=memory` and does not send a transaction.

### Dashboard (local, read-only)

```bash
npm run dashboard
# http://127.0.0.1:4173
```

The page calls the public EVM RPC from the browser. Remaining, provider, and expiry are whatever `tabs` / `remaining` return. If the RPC is quiet, the table stays empty. With the gateway running, the same page can probe `http://127.0.0.1:8402/quote`. It never asks for a key.

**TODO:** a public URL for this page.

### Substrate interop (dry-run on public testnet)

```bash
npm run revive-probe
```

Writes [`../runs/revive-probe.json`](../runs/revive-probe.json). No signature, no extrinsic.

What the checked-in probe already shows (block 148943):

| Check | Result |
|---|---|
| `remaining(1)` | `5000000000000000` from both `ReviveApi_call` and `eth_call` |
| `tabs(1)` / `nextId()` | Same return data as `eth_call`. `nextId` was 3 |
| `Revive.call` | Unsigned SCALE, pallet 80, call 1. Not submitted |
| `settle` dry-run | Revert `NotProvider` (`0x3480e2b2`). Origin is the payer of tab #1, not the provider `0x7F220d4db849E7Ee220f9F8fdD99fc016b3F3369` |
| Assets precompile | Asset id 2 → `0x0000000200000000000000000000000000010000`, supply `15000000000000000000` |

**TODO:** a submitted `Revive.call` extrinsic, and an ERC-20 tab actually opened through that precompile. The gateway still prices native tPOT only.

## 3. Contract demo that predates the gateway (tab #1)

Still the clearest "open then settle" pair, from 2026-10-22:

| Step | Tx |
|---|---|
| Deploy | `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72` |
| Open tab #1 | `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e` · deposit `1e16` wei · provider `0x7F220d4db849E7Ee220f9F8fdD99fc016b3F3369` |
| Settle | `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b` · cumulative `5e15` wei |

The Week 2 video shows these hashes on screen. The gateway proof is tab #2, above.

## 4. What this product is

An agent escrows native tPOT once (`open`). Each API call carries an EIP-712 voucher for a new cumulative amount. The provider's gateway answers unpaid calls with HTTP 402 and batch-settles with one `settle` transaction. After expiry the agent calls `refund`. Chain `420420777` only — no x402 facilitator and no stablecoin rail. Reuse of the author's MIT AgentTab contract is disclosed in the README.

## 中文 — 评委五分钟

1. 读 [`STATUS.md`](../STATUS.md)。Pitch 打开 `docs/pitch.html`（或 GitHub blob，2026-10-29 为 HTTP 200）。Week 2 视频是 `docs/demo-checkin.mp4`，内容是合约 open/settle 标题卡，**不是**网关或仪表盘录屏。
2. **网关 + SDK：** tab #2 开单 `0x9922d9a7…f886`，结算 `0x2031c40d…df99`。本地无密钥：`npm test` 然后 `npm run dry-run`（402 → 付费一次 → 重放被拒）。
3. **仪表盘：** `npm run dashboard`，浏览器打开 `http://127.0.0.1:4173`，向公开 RPC 读 tab。公开网址 **TODO**。
4. **Substrate：** `npm run revive-probe`。`remaining(1)` 在 `ReviveApi_call` 与 `eth_call` 上一致。没有提交 extrinsic（**TODO**）。
5. GitHub Pages 正式网址 **TODO**（`zwang1111.github.io/agenttab-portaldot` 在 2026-10-29 为 404）。托管版最终视频 **TODO**。BUIDL：https://dorahacks.io/build/50150
