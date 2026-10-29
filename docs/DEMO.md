# Demo video — Week 2 check-in

> Freeze path (gateway + SDK settle, dashboard, Substrate probe): [`FINAL-DEMO.md`](FINAL-DEMO.md) and [`../STATUS.md`](../STATUS.md). This page is the Week 2 cut only.

**File:** [`demo-checkin.mp4`](demo-checkin.mp4) (≤3 min, static title-card walkthrough)  
**Pitch deck:** [`pitch.html`](pitch.html) (open in a browser; arrow keys / swipe)  
**Pages entry:** [`index.html`](index.html)

## What the video shows

A ~90s on-screen walkthrough for DoraHacks Portaldot Hacker House Week 2 — no secrets, no local UI recording. Frames cover:

1. **Title** — AgentTab on Portaldot V3, Modular Cloud & Middleware, BUIDL #50150, repo link  
2. **One-liner** — escrow once, EIP-712 voucher per call, batch settle (no API keys / per-call gas)  
3. **Flow diagram** — `open` → `voucher` → `settle` with demo amounts (deposit `1e16`, cumulative `5e15`)  
4. **Network & addresses** — chain `420420777`, AgentTab contract, deployer, RPC, node-console  
5. **Tx hashes** — deploy, demo open, demo settle (full hashes on-screen)  
6. **Public artifacts** — GitHub, pitch deck, `DEPLOYMENT.md`, `forge test` 7/7, outstanding items  
7. **Ask** — office hours / mentor feedback for gas quirks, Revive.call, HTTP 402 gateway

## Live proof (same facts as video)

| Item | Value |
|---|---|
| Repo | https://github.com/zwang1111/agenttab-portaldot |
| BUIDL | https://dorahacks.io/build/50150 |
| AgentTab | `0x9a096C216f79e08C2DB95d92F412697D8F1f9329` |
| Deploy tx | `0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72` |
| Open tx | `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e` |
| Settle tx | `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b` |
| Deployer | `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` |

Full deployment notes, gas flags, and redeploy steps: **[`../DEPLOYMENT.md`](../DEPLOYMENT.md)**  
Machine-readable: [`../deployments/portaldot-testnet.json`](../deployments/portaldot-testnet.json)  
Check-in paste answers: [`../CHECKIN.md`](../CHECKIN.md)

## How to view

```bash
# Pitch (local)
open docs/pitch.html   # or any browser

# Video
ffplay docs/demo-checkin.mp4
# or upload demo-checkin.mp4 to YouTube / Vimeo / Loom for the DoraHacks form
```

Raw GitHub URLs (after push to `main`):

- Pitch: `https://raw.githubusercontent.com/zwang1111/agenttab-portaldot/main/docs/pitch.html`
- Video: `https://raw.githubusercontent.com/zwang1111/agenttab-portaldot/main/docs/demo-checkin.mp4`
- Blob view: `https://github.com/zwang1111/agenttab-portaldot/blob/main/docs/pitch.html`
