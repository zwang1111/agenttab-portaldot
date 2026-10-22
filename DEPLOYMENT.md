# Portaldot V3 testnet deployment

Deployed **2026-10-22** (Asia/Shanghai) for Hacker House check-in.

| Item | Value |
|---|---|
| Network | Portaldot V3 Testnet |
| Chain ID | `420420777` |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| Substrate RPC | `wss://test-node-v3.portaldot.dev` |
| Explorer | https://node-console.portaldot.dev (no Etherscan-style UI; use Network → events) |
| Token | tPOTv3 |
| Deployer | `0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` |

## Contracts

| Contract | Address | Deploy tx |
|---|---|---|
| **AgentTab** | [`0x9a096C216f79e08C2DB95d92F412697D8F1f9329`](https://node-console.portaldot.dev) | [`0xe8a4376602a5467574dd7f2e966006da4fe41275d28a989e33f116fa57baab72`](https://node-console.portaldot.dev) |

Compiler: solc `0.8.24`, EVM `paris`, optimizer `runs=1`, `via_ir=true` (needed so `eth_estimateGas` × base fee fits the deployer balance on this eth-rpc).

Machine-readable copy: [`deployments/portaldot-testnet.json`](deployments/portaldot-testnet.json).

## Demo interactions (native tPOT tab)

| Step | Tx hash | Notes |
|---|---|---|
| Fund demo provider | `0xc12b93e4bc199bf3e9bc53e57e4439862b5267d379b3c9310efc8aa91866f59c` | 5 tPOT to provider for settle gas |
| **open** tab #1 | `0xc27ab271b49103a257046c7458805ed1c73988d464f61aa98bfe6338a13e534e` | payer=deployer, provider=`0x7F220d4db849E7Ee220f9F8fdD99fc016b3F3369`, deposit=`1e16` wei, token=native |
| **settle** | `0xd58678d04863861cda814284eb2879d0abcaf85ca64779cc5e69f2a670b8ac5b` | cumulative=`5e15` wei (half deposit) via EIP-712 voucher |

After settle, `remaining(1) == 5e15`. Expiry is far enough that refund was not required for check-in.

## How to redeploy

```bash
cp .env.example .env   # throwaway testnet key only; set DEPLOYER_ADDRESS
scripts/deploy.sh
```

`scripts/deploy.sh` uses `cast send --create` with `--legacy` and `eth_estimateGas` as `--gas-limit`. Plain `forge create` against this RPC often returns `Invalid Transaction` (1010) or mines with status 0 if the gas limit is far below the packed estimate.
