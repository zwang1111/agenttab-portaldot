# DoraHacks check-in — copy-paste answers (AgentTab on Portaldot)

> Week 2 form paste (deadline was **Oct 24 20:00 Asia/Shanghai**). The outstanding list in section 2 is that week's list. Freeze status as of the repo snapshot is [`STATUS.md`](STATUS.md); the judge path is [`docs/FINAL-DEMO.md`](docs/FINAL-DEMO.md).

Use these for the Portaldot Hacker House 2026 check-in form (deadline **Oct 24 20:00 Asia/Shanghai / UTC+8**).  
No secrets. Live deploy facts as of 2026-10-22.

**Project / track:** AgentTab on Portaldot — Modular Cloud & Middleware  
**Repo:** https://github.com/zwang1111/agenttab-portaldot (`main`)

---

## 1. Current project progress / 当前项目进度

**English**

AgentTab escrow is ported to Portaldot V3 EVM with native tPOT tabs, reentrancy guard, and Foundry tests (7/7 passing). The contract is **deployed on Portaldot V3 testnet** (chain ID `420420777`):

- AgentTab: `0x9a096C216f79e08C2DB95d92F412697D8F1f9329`
- Deploy tx: `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`
- Demo open: `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e`
- Demo settle: `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b`

Public GitHub is live with README architecture diagram and `DEPLOYMENT.md`. Deployer `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` still holds ~167 tPOT after deploy.

**中文**

AgentTab 托管合约已移植到 Portaldot V3 EVM，支持原生 tPOT 开单、重入保护，Foundry 测试 7/7 通过。合约已部署到 Portaldot V3 测试网（chain ID `420420777`）：

- 合约地址 AgentTab：`0x9a096C216f79e08C2DB95d92F412697D8F1f9329`
- 部署交易：`0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`
- 演示 open：`0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e`
- 演示 settle：`0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b`

公开 GitHub 已上线，README 含架构图，详情见 `DEPLOYMENT.md`。部署账户 `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` 部署后约剩 167 tPOT。

---

## 2. Outstanding items / 待完成事项

**English**

- ~~Pay-per-call provider gateway (HTTP 402 → EIP-712 voucher) and TypeScript agent SDK (viem, chain `420420777`, 14-decimal helpers).~~ **Done:** `gateway/` + `sdk/` (`npm test`, `npm run dry-run`). AgentTab rail only — no Celo x402 facilitator.
- Substrate interop: settle via `Revive.call` from a native `5…` account; Assets-pallet token as tab currency (ERC-20 precompile or wrapped mock).
- Web dashboard for tabs / vouchers / settlements with node-console links.
- ≤ 3-min demo video and pitch deck for final submission.

**中文**

- ~~按次付费网关（HTTP 402 → EIP-712 voucher）与 TypeScript agent SDK（viem、chain `420420777`、14 位小数辅助）。~~ **已完成：** `gateway/` + `sdk/`（`npm test`、`npm run dry-run`）。仅 AgentTab 通道，不接 Celo x402 facilitator。
- Substrate 互通：从原生 `5…` 账户经 `Revive.call` 结算；Assets pallet 代币作为 tab 币种（ERC-20 预编译或封装 mock）。
- Web 仪表盘：tabs / vouchers / settlements，并链接 node-console。
- ≤ 3 分钟演示视频与最终提交用 pitch deck。

---

## 3. Public GitHub / 公开仓库

**English / 中文（同）**

https://github.com/zwang1111/agenttab-portaldot

Complete README with product architecture (mermaid sequence: agent → provider → AgentTab on Portaldot V3 EVM), continuous commits, and deployment records in `DEPLOYMENT.md` / `deployments/portaldot-testnet.json`.

README 含产品架构图（mermaid：agent → provider → Portaldot V3 EVM 上的 AgentTab），提交记录持续更新，部署信息见 `DEPLOYMENT.md` 与 `deployments/portaldot-testnet.json`。

---

## 4. Portaldot testnet deployment info / 测试网部署信息

**English**

| Item | Value |
|---|---|
| Chain ID | `420420777` |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| Explorer | https://node-console.portaldot.dev |
| Contract (AgentTab) | `0x9a096C216f79e08C2DB95d92F412697D8F1f9329` |
| Deploy tx | `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72` |
| Demo open tx | `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e` |
| Demo settle tx | `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b` |
| Deployer | `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` |

**中文（粘贴用短版）**

- 网络：Portaldot V3 Testnet，chain ID `420420777`
- RPC：`https://test-evm-rpc-v3.portaldot.dev`
- 浏览器 / 节点控制台：https://node-console.portaldot.dev
- 合约 AgentTab：`0x9a096C216f79e08C2DB95d92F412697D8F1f9329`
- 部署交易：`0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`
- 演示 open / settle：`0xc27ab271…534e` / `0xd58678d0…ac5b`（完整哈希见上表或仓库 `DEPLOYMENT.md`）

---

## 5. Initial demo / 初始演示说明

**English**

Core product flow is already on testnet: native tPOT tab **open** then **settle** with an EIP-712 voucher (tx hashes above). Run `forge test` locally for the full unit suite. Optional next: ≤ 3-min screen recording of deploy + open/settle, or a static replay page.

**中文**

核心流程已在测试网完成：原生 tPOT tab **open** → 带 EIP-712 voucher 的 **settle**（交易哈希见上）。本地可跑 `forge test`。可选补充：≤ 3 分钟录屏（部署 + open/settle），或静态回放页。

---

## One-liner / 一句话（可选）

**EN:** AI agents escrow tPOT once, sign an EIP-712 voucher per API call; providers batch-settle on Portaldot V3 — machine-to-machine micropayments without API keys or per-call gas.

**中文：** AI agent 一次性托管 tPOT，每次 API 调用签 EIP-712 voucher，服务商在 Portaldot V3 批量结算——无需 API Key、无需每笔调用单独付 gas 的机对机微支付。

## Reuse disclosure / 复用说明（可选）

Based on the author's MIT AgentTab contract (Celo, Oct 2026). Portaldot-specific code written during the Hacker House. Uses forge-std (MIT/Apache-2.0).

基于作者 MIT 协议的 AgentTab 合约（Celo，2026-10）。Portaldot 相关代码于 Hacker House 期间编写。依赖 forge-std（MIT/Apache-2.0）。
