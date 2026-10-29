# STATUS — AgentTab on Portaldot V3

**BUIDL** [50150](https://dorahacks.io/build/50150) · **Repo** [zwang1111/agenttab-portaldot](https://github.com/zwang1111/agenttab-portaldot) · **Freeze** 2026-11-06

Snapshot for judges. Facts below are the ones already recorded in this repo (`DEPLOYMENT.md`, `deployments/portaldot-testnet.json`, `runs/`). This file does not add new chain transactions.

中文摘要在文末。

## What a judge can treat as shipped

| Surface | State | Proof already in the repo |
|---|---|---|
| Contract on Portaldot V3 testnet | Deployed | AgentTab `0x9a096C216f79e08C2DB95d92F412697D8F1f9329`, chain `420420777`. Deploy tx `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`. |
| Native tPOT tab open + settle | On-chain | Tab #1 open `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e`, settle `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b`. After settle, `remaining(1) == 5e15` wei. |
| Gateway + SDK settle | On-chain | 2026-10-23. Tab #2 opened by `npm run open-tab` (`0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886`, deposit `0.01` tPOT). Unpaid `GET /quote` returned 402. `npm run call` settled `0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99` at cumulative `1e14` wei (`0.0001` tPOT), `SETTLE_EVERY=1`. Log: `runs/gateway-sdk-live-20261023.json`. |
| Dashboard | In repo, local | Static inspector in `dashboard/`. `npm run dashboard` → `http://127.0.0.1:4173`. Reads `tabs`, `remaining`, `nextId`, and `Opened` / `Settled` logs from the public EVM RPC. No key. |
| Substrate interop | Probed, not submitted | `npm run revive-probe` at block 148943 (spec `portaldot-v3` 3002). `ReviveApi_call` and `eth_call` both return `remaining(1) == 5000000000000000`. Unsigned `Revive.call` bytes (pallet 80, call 1) are in `runs/revive-probe.json`. Asset id 2 precompile `0x0000000200000000000000000000000000010000` matches `Assets.Asset(2)` supply. |

Same bytecode for the EVM JSON-RPC path and the Substrate `Revive` path. There is no second contract.

## Network (unchanged)

| | |
|---|---|
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| Substrate RPC | `wss://test-node-v3.portaldot.dev` |
| Token | tPOTv3 — 14 decimals on Substrate, 18-decimal wei on the EVM RPC (`1 planck = 10_000 wei`) |
| Node console | https://node-console.portaldot.dev (Network → events; no per-transaction route) |
| Deployer | `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` |
| Deployer fallback SS58 | `5Fe78D5g5NcrMU2J97UXdQEMU1DSNwgh7knaHirpD8J8th3U` (public `H160 \|\| 0xEE×12`) |

## Tests that exist in the tree

- Foundry, `test/AgentTab.t.sol` (7): `testSettleBatches`, `testRejectBadSigAndStale`, `testRefundAfterExpiry`, `testTopUp`, `testNativeTab`, `testNativeBadValue`, `testTopUpUnknownTab`. README records `forge test` 7/7 on 2026-10-22. This environment has no `forge` binary, so that count is the recorded one.
- Node, 39 `test()` cases: `sdk/test` 25, `gateway/test` 8, `substrate/test` 6. Covers the 402 body, voucher accept/replay, settle handoff, tPOT decimal split, dashboard calldata, and Revive SCALE.
- The 2026-10-23 live log records `npm test` 22/22 and a passing `npm run dry-run` at git `688dc08` (before the dashboard and Substrate test files). Current CI is `.github/workflows/test.yml`: `npm ci`, `npm test`, `npm run typecheck`, `npm run dry-run`.

## Public links

These URLs are already cited in the repo and responded **HTTP 200** on 2026-10-29:

| Artifact | URL |
|---|---|
| Pitch (GitHub blob) | https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/pitch.html |
| Pitch (raw) | https://raw.githubusercontent.com/zwang1111/agenttab-portaldot/main/docs/pitch.html |
| Pitch PDF | https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/pitch.pdf |
| Week 2 video (blob) | https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/demo-checkin.mp4 |
| Week 2 video (raw) | https://raw.githubusercontent.com/zwang1111/agenttab-portaldot/main/docs/demo-checkin.mp4 |
| BUIDL page | https://dorahacks.io/build/50150 |

The DoraHacks page is the id this repo already prints (`docs/DEMO.md`, `docs/pitch.html`). An unauthenticated fetch on 2026-10-29 received a WAF captcha, so this snapshot does not restate the form fields.

## TODO before calling a link "live"

| Item | Mark |
|---|---|
| Published GitHub Pages URL | **TODO.** `GET https://zwang1111.github.io/agenttab-portaldot/` was 404 on 2026-10-29, and the Pages API has no site. `docs/index.html` is ready for a Pages source of branch `main`, folder `/docs`. |
| Hosted final demo video (YouTube / Loom / similar) | **TODO.** No such URL is in the README or elsewhere in this repo. `docs/demo-checkin.mp4` is the Week 2 title-card walkthrough (contract open/settle). It does not show the gateway, the dashboard, or the Substrate probe. |
| Public dashboard URL | **TODO.** README only documents `npm run dashboard` on `http://127.0.0.1:4173`. |
| Submitted `Revive.call` extrinsic | **TODO.** The probe stores unsigned SCALE. `submittedExtrinsic` in `deployments/portaldot-testnet.json` is null. `settle` dry-run from the deployer fallback reverted `NotProvider` (`0x3480e2b2`) because that origin is tab #1's payer, not its provider. |
| ERC-20 tab opened through the Assets precompile | **TODO.** `ReviveApi_call` of `open` reverted with empty returndata. The HTTP 402 gateway prices native tPOT only. |

## Where to read next

- Five-minute judge path: [`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md)
- Pages entry (relative links to the pitch and the Week 2 video): [`docs/index.html`](docs/index.html)
- Hashes and gas notes: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Week 2 check-in paste (historical outstanding list): [`CHECKIN.md`](CHECKIN.md)

## 中文（评委短版）

AgentTab 已部署在 Portaldot V3 测试网（chain `420420777`），合约 `0x9a096C216f79e08C2DB95d92F412697D8F1f9329`。

- **网关 + SDK 结算已上链。** 2026-10-23：`npm run open-tab` 开 tab #2，未付款 `GET /quote` 返回 402，`npm run call` 结算交易 `0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99`（`0.0001` tPOT）。
- **仪表盘在仓库里。** `dashboard/` 只读，`npm run dashboard` 打开 `http://127.0.0.1:4173`，余额来自公开 RPC。没有公开托管地址。
- **Substrate 互通已探测。** `ReviveApi_call` 与 `eth_call` 读到的 `remaining(1)` 一致。`Revive.call` 字节已编码，**没有提交 extrinsic**。

Pitch 与 Week 2 视频使用仓库里已有的 GitHub 地址（见上表）。GitHub Pages 站点、托管版最终演示视频、公开仪表盘地址仍是 **TODO**。五分钟路径见 `docs/FINAL-DEMO.md`。
