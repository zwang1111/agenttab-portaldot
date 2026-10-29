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
| Dashboard | Public and local. [https://zwang1111.github.io/agenttab-portaldot/](https://zwang1111.github.io/agenttab-portaldot/) returned **HTTP 200** on 2026-10-29. That URL is the inspector: Pages publishes the contents of [`dashboard/`](dashboard/) at the site root. Same files locally with `npm run dashboard` on `http://127.0.0.1:4173`. No key. |
| Check-in video | [`docs/demo-checkin.mp4`](docs/demo-checkin.mp4) is in the repo. It is a static title-card walkthrough, not a recording of the gateway or the dashboard. |
| Pitch | [`docs/pitch.html`](docs/pitch.html) and [`docs/pitch.pdf`](docs/pitch.pdf). |

Hashes are copied from [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`deployments/portaldot-testnet.json`](deployments/portaldot-testnet.json). The node console (https://node-console.portaldot.dev) has no per-transaction route: Network → events, then paste the hash.

`DEPLOYMENT.md` previously said the probe block was 148943. The checked-in JSON field `blockNumber` is 148951. The prose now follows the JSON.

## Dashboard URL

Checked with `curl -sI` on 2026-10-29. Send judges to the first row.

| URL | HTTP on 2026-10-29 | Use for judges? |
|---|---|---|
| [https://zwang1111.github.io/agenttab-portaldot/](https://zwang1111.github.io/agenttab-portaldot/) | **200** | Yes. This is the dashboard. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) uploads `dashboard/` (`path: dashboard`), so the site root is `dashboard/index.html`. |
| `http://127.0.0.1:4173` after `npm run dashboard` | local | Yes, on the presenter's machine. Same files. |
| [htmlpreview of `dashboard/index.html`](https://htmlpreview.github.io/?https://github.com/zwang1111/agenttab-portaldot/blob/main/dashboard/index.html) | **200** | Spare copy of the same page. The script is classic `dashboard/browser.js`. Not the Pages site. |

The path `/dashboard/` on that github.io host is **HTTP 404 by design**. The artifact is the contents of `dashboard/`, not a nested `dashboard/` directory, so do not append `/dashboard/` or `dashboard/index.html` to the host. [`docs/index.html`](docs/index.html) is the repo packet for judges. It is not what the Pages site serves.

jsDelivr returns HTTP 200 for `dashboard/index.html` but with `Content-Type: text/plain`, so a browser shows source text rather than the inspector. It is not the demo link.

## Plan through the freeze

Docs and config only, unless a judge-facing bug is blocking the demo.

1. Keep the gateway 402 + the public dashboard + recorded hashes as the demo ([`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md)). The dashboard judges open is [https://zwang1111.github.io/agenttab-portaldot/](https://zwang1111.github.io/agenttab-portaldot/) (HTTP 200).
2. Record a hosted final demo of the gateway 402 and that dashboard reading tab #1 and tab #2. `docs/demo-checkin.mp4` is the Week 2 title-card cut. Do not submit it as this video.
3. If the DoraHacks final form is still open, the entrant submits it while logged in at https://dorahacks.io/buidl/50150. This repo cannot file it.

Stop bulk core commits at **2026-11-05 12:00 Asia/Shanghai**. Freeze at **2026-11-06 12:00 Asia/Shanghai**.

## Remaining gaps

- **Hosted final demo video of the gateway and the dashboard.** `docs/demo-checkin.mp4` is the Week 2 title-card walkthrough. It does not show the gateway or the dashboard. No YouTube or Loom URL is in this repo.
- **DoraHacks final form, if it is still required.** Submission is behind user login on https://dorahacks.io/buidl/50150. This repository does not submit it.

## Reuse

`src/AgentTab.sol` is a port of the author's MIT AgentTab contract, written 2026-10-15 for the Celo entry ([agenttab-celo](https://github.com/zwang1111/agenttab-celo)). That repository's x402 facilitator, USA₮, and EIP-3009 rail are not in this repo. Portaldot-only code: native tPOT tabs, `sdk/`, `gateway/`, `substrate/`, `dashboard/`.

## 中文（提交表用）

截至 **2026-10-29（北京时间）**：网关与 SDK 已在测试网跑通（tab #2 open/settle）；Substrate `ReviveApi_call` 与 `eth_call` 对 `remaining(1)` 一致，记录里没有已提交的签名 extrinsic。仪表盘已发布：[https://zwang1111.github.io/agenttab-portaldot/](https://zwang1111.github.io/agenttab-portaldot/) 为 **HTTP 200**，站点根目录就是 `dashboard/` 的内容。该主机上的 `/dashboard/` 路径按发布方式为 **404**，不要加这段路径。`docs/demo-checkin.mp4` 是 Week 2 标题卡，不是网关或仪表盘录屏。仍待办只有两件：托管的最终演示视频（网关 402 + 仪表盘），以及如仍需要、须登录后本人提交的 DoraHacks 最终表单（本仓库不代交）。代码冻结 **2026-11-06 12:00（北京时间）**，2026-11-05 12:00 之后不再做大批量核心提交。
