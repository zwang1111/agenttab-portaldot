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

## Gateway + SDK live demo (2026-10-23, Asia/Shanghai)

After PR #1 merge (`688dc08`), `npm test` (22/22) and `npm run dry-run` passed. Live path against Portaldot V3:

| Step | Tx / result | Notes |
|---|---|---|
| **open** tab #2 | [`0x9922d9a777df59b54013e9d944672e6cc487d6c357ce38b19cec2813a4abf886`](https://node-console.portaldot.dev) | `npm run open-tab` · deposit `0.01` tPOT · payer=provider=`0x9e2e2024c7dcA86e57608e2ceAD160081c381fDd` |
| unpaid `GET /quote` | HTTP 402 | `CHAIN_MODE=rpc` gateway on `:8402` |
| paid call + **settle** | [`0x2031c40d5b2edf95d8a8b36961a91eb2dd0b4d563622f74721dc5aa35283df99`](https://node-console.portaldot.dev) | `npm run call` · cumulative `1e14` wei (`0.0001` tPOT) · `SETTLE_EVERY=1` |

Machine-readable: [`runs/gateway-sdk-live-20261023.json`](runs/gateway-sdk-live-20261023.json). Env mapping: root `.env` `PRIVATE_KEY` → `AGENT_PK` / `PROVIDER_PK` in gitignored `.env.local` (never committed).

## Substrate `Revive.call` probe (no submitted extrinsic)

`npm run revive-probe` reads the public testnet. The account it uses is the deployer's fallback id `5Fe78D5g5NcrMU2J97UXdQEMU1DSNwgh7knaHirpD8J8th3U` (`H160 || 0xEE×12`), which is public. The script calls `state_call("ReviveApi_call")`, `eth_call`, and `state_getStorage`. It does not sign.

Recorded in [`runs/revive-probe.json`](runs/revive-probe.json) at block 148943, spec `portaldot-v3` 3002:

| Check | Result |
|---|---|
| `remaining(1)` | `5000000000000000` from both `ReviveApi_call` and `eth_call` |
| `tabs(1)` / `nextId()` | Same return data as `eth_call`. `nextId` is 3 |
| `settle` dry-run | Revert `NotProvider` (`0x3480e2b2`). Origin is the payer, not tab 1's provider. Not a settle |
| `Revive.call` bytes | Unsigned SCALE in the JSON (`pallet index 80`, `call index 1`). Not submitted |
| Assets precompile | Asset id 2 → `0x0000000200000000000000000000000000010000`. Supply `15000000000000000000` matches `Assets.Asset(2)` |
| ERC-20 `open` dry-run | Reverted, empty returndata, 183504695 gas. No ERC-20 tab was opened |

`Revive.AutoMap` is true in this runtime's metadata, so `map_account` is disabled. Polkadot Hub precompile suffixes `0x01200000` / `0x02200000` / `0x03200000` have no code here. The `AssetsPrecompiles` foreign index for asset 2 is `1`, and that index is the wrong id to put in the address (supply at id 1 is 0).

## How to redeploy

```bash
cp .env.example .env   # throwaway testnet key only; set DEPLOYER_ADDRESS
scripts/deploy.sh
```

`scripts/deploy.sh` uses `cast send --create` with `--legacy` and `eth_estimateGas` as `--gas-limit`. Plain `forge create` against this RPC often returns `Invalid Transaction` (1010) or mines with status 0 if the gas limit is far below the packed estimate.
