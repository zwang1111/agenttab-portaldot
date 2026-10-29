# Status — AgentTab on Portaldot V3

**As of 2026-10-29 (Asia/Shanghai).** Facts below are the files already on `main` plus the checks recorded in this refresh. No new transactions were sent for this note.

Code freeze for Portaldot Hacker House 2026 finalists: **2026-11-06 12:00 Asia/Shanghai**. No bulk core commits after **2026-11-05 12:00 Asia/Shanghai**. This page is the plan through that cutoff. Judge script: [`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md).

BUIDL: https://dorahacks.io/buidl/50150  
Repo: https://github.com/zwang1111/agenttab-portaldot

## Live

| Piece | State |
|---|---|
| AgentTab on Portaldot V3 testnet (chain `420420777`) | Deployed. Address `0x9a096C216f79e08C2DB95d92F412697D8F1f9329`. Deploy tx `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`. |
| Native tPOT tab #1 open + settle | `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e` / `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b`. |
| Gateway + TypeScript SDK | Live on testnet 2026-10-23. Tab #2 open `0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886`, settle `0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99`. Record: [`runs/gateway-sdk-live-20261023.json`](runs/gateway-sdk-live-20261023.json). Unpaid `GET /quote` is HTTP 402. `npm test` and `npm run dry-run` need no key. |
| Substrate ReviveApi probes | `npm run revive-probe` writes [`runs/revive-probe.json`](runs/revive-probe.json). At block **148951**, `ReviveApi_call` and `eth_call` both return `remaining(1) == 5000000000000000`. A `settle` dry-run reverts `NotProvider`. Unsigned `Revive.call` bytes are in the JSON (`submitted: false`). |
| Dashboard | Static inspector on `main` in [`dashboard/`](dashboard/). `npm run dashboard` serves it on `http://127.0.0.1:4173`. No key. |
| Check-in video | [`docs/demo-checkin.mp4`](docs/demo-checkin.mp4) is in the repo. It is a static title-card walkthrough, not a recording of the gateway or the dashboard. |
| Pitch | [`docs/pitch.html`](docs/pitch.html) and [`docs/pitch.pdf`](docs/pitch.pdf). |

Hashes are copied from [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`deployments/portaldot-testnet.json`](deployments/portaldot-testnet.json). The node console (https://node-console.portaldot.dev) has no per-transaction route: Network → events, then paste the hash.

`DEPLOYMENT.md` previously said the probe block was 148943. The checked-in JSON field `blockNumber` is 148951. The prose now follows the JSON.

## Dashboard URL

| URL | HTTP on 2026-10-29 | Use for judges? |
|---|---|---|
| [htmlpreview of `dashboard/index.html`](https://htmlpreview.github.io/?https://github.com/zwang1111/agenttab-portaldot/blob/main/dashboard/index.html) | **200** | Yes, once this refresh is on `main`. Relative path: `dashboard/index.html`. The page loads classic `dashboard/browser.js` (`type="module"` does not run here, because raw GitHub serves `.js` as `text/plain`). On 2026-10-29 the same previewer, pointed at the branch that adds `browser.js`, rendered tab #1 and tab #2 from the public RPC. |
| `https://zwang1111.github.io/agenttab-portaldot/` | **404** | No. |
| `https://zwang1111.github.io/agenttab-portaldot/dashboard/` | **404** | No. |
| `https://zwang1111.github.io/agenttab-portaldot/dashboard/index.html` | **404** | No. |
| `http://127.0.0.1:4173` after `npm run dashboard` | local | Yes, on the presenter's machine. |

GitHub Pages is the preferred host. It is **not enabled**. `GET /repos/zwang1111/agenttab-portaldot/pages` was 404, and `POST` with `build_type=workflow` returned **403** `Resource not accessible by integration`. This repository's token cannot turn Pages on.

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) uploads `dashboard/` with the official Pages actions. It deploys only when the Pages API returns 200. While Pages is off, the workflow skips the deploy and stays green. An admin still has to set **Settings → Pages → Build and deployment → Source → GitHub Actions**, then run the `pages` workflow (or push a `dashboard/` change). Re-check the github.io URL before putting it in front of judges. Do not describe it as live while it 404s.

jsDelivr returns HTTP 200 for `dashboard/index.html` but with `Content-Type: text/plain`, so a browser shows source text rather than the inspector. It is not the demo link.

## Plan through the freeze

Docs and config only, unless a judge-facing bug is blocking the demo.

1. Keep the gateway 402 + dashboard + recorded hashes as the demo ([`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md)).
2. Repo admin enables GitHub Pages (steps above) and confirms HTTP 200. Until then, send htmlpreview or `npm run dashboard`.
3. Record a real product demo (gateway 402, then the dashboard reading tab #1 and tab #2). Do not submit `docs/demo-checkin.mp4` as that video.
4. Submit the DoraHacks final form while logged in. The form is user-login; this repo cannot file it.
5. Optional, and not required for the demo: a **signed** Substrate extrinsic (`Revive.call`, pallet 80, call 1). The probe stopped at unsigned bytes on purpose.

Stop bulk core commits at **2026-11-05 12:00 Asia/Shanghai**. Freeze at **2026-11-06 12:00 Asia/Shanghai**.

## Remaining gaps

- **Real product demo video.** `docs/demo-checkin.mp4` is static cards (title, hashes, architecture). It does not show the gateway or the dashboard.
- **Hosted dashboard URL.** GitHub Pages is not enabled. github.io returned HTTP 404 on 2026-10-29. htmlpreview is the interim one-click link, not the preferred host.
- **DoraHacks final form.** Submission is behind user login on https://dorahacks.io/buidl/50150. Nobody can complete it from CI or from this repository.
- **Optional signed Substrate extrinsic.** `ReviveApi_call` dry-runs are recorded. No signed `Revive.call` was submitted (`runs/revive-probe.json` has `"submitted": false`).

## Reuse

`src/AgentTab.sol` is a port of the author's MIT AgentTab contract, written 2026-10-15 for the Celo entry ([agenttab-celo](https://github.com/zwang1111/agenttab-celo)). That repository's x402 facilitator, USA₮, and EIP-3009 rail are not in this repo. Portaldot-only code: native tPOT tabs, `sdk/`, `gateway/`, `substrate/`, `dashboard/`.

## 中文（提交表用）

截至 **2026-10-29（北京时间）**：网关与 SDK 已在测试网跑通（tab #2 open/settle）；Substrate `ReviveApi_call` 与 `eth_call` 对 `remaining(1)` 一致；仪表盘在 `main` 的 `dashboard/`；`docs/demo-checkin.mp4` 与 `docs/pitch.pdf` 已在仓库。检查视频是静态卡片，不是产品录屏。`https://zwang1111.github.io/agenttab-portaldot/` 当日为 HTTP 404，不能当演示地址。DoraHacks 最终表单需要登录后本人提交。签名的 Substrate extrinsic 仍是可选项，当前只有未签名的 `Revive.call` 字节。代码冻结 **2026-11-06 12:00（北京时间）**，2026-11-05 12:00 之后不再做大批量核心提交。
