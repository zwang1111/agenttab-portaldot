# Architecture — AgentTab on Portaldot V3

Pay-per-call middleware for an API provider and an AI agent. The agent escrows native **tPOTv3** once. Each HTTP call carries an EIP-712 voucher. The provider batch-settles on Portaldot V3's EVM (pallet-revive).

This is the Portaldot path. It does not use the Celo sibling's x402 facilitator, USA₮, or EIP-3009 rail. Those services are not on this chain.

## Components

```mermaid
flowchart LR
  subgraph offchain [Off chain]
    SDK["sdk/ agent client"]
    GW["gateway/ HTTP 402"]
  end
  subgraph chain [Portaldot V3 testnet]
    EVM["AgentTab.sol\nchain 420420777"]
    SUB["Substrate balances\n14-decimal tPOT"]
  end
  SDK -->|"GET /quote"| GW
  GW -->|"402 price + AgentTab domain"| SDK
  SDK -->|"open{value: tPOT}"| EVM
  SDK -->|"GET /quote + X-AgentTab-Voucher"| GW
  GW -->|"verify EIP-712, then settle"| EVM
  EVM -->|"native call{value:}"| SUB
```

| Piece | Role |
|---|---|
| `src/AgentTab.sol` | Escrow. Native tabs use `token = address(0)` and payable `open` / `topUp`. `settle` pays the provider the delta of a cumulative voucher. `refund` returns the rest after expiry. |
| `sdk/` | Chain config, tPOT unit helpers, voucher sign/verify, and the legacy-gas writers used against pallet-revive. |
| `gateway/` | Provider process. Unpaid `GET /quote` is **402**. A valid `X-AgentTab-Voucher` is **200** and, every N calls, one `settle`. |

## HTTP 402 body

`GET /quote` with no voucher responds `402` and `X-AgentTab-Required`. The JSON body is the whole offer:

- `price.amountWei` — EVM `uint256` the voucher must cover (18-decimal wei).
- `price.amountTpot` / `price.amountPlanck` — the same price in human tPOT and in Substrate planck.
- `accept.scheme = "agenttab"`, `accept.network = "eip155:420420777"`.
- `accept.contract` — AgentTab (`0x9a096C216f79e08C2DB95d92F412697D8F1f9329` on testnet).
- `accept.payTo` — the provider who may call `settle`.
- `accept.voucher` — EIP-712 domain `AgentTab` / `1` / chain id / contract, type `Voucher(uint256 tabId,uint256 cumulative)`.
- `accept.open` — payable `open(payTo, address(0), depositWei, expiry)` with `msg.value = depositWei`.

The paid request repeats `GET /quote` with:

```
X-AgentTab-Voucher: {"tabId":"1","cumulative":"100000000000000","signature":"0x…"}
```

The header may also be that JSON encoded as base64url. The gateway accepts the call only when all of the following hold:

1. `tabs(tabId)` exists and `provider` is this gateway.
2. The tab token is native tPOT (`address(0)`). ERC-20 tabs stay on the contract but are not this gateway's price.
3. `cumulative` is strictly above the last accepted amount (and above on-chain `claimed`), the delta is at least the price, and `cumulative` does not exceed `deposit`.
4. `block` time is before `expiry`.
5. `ecrecover` of the EIP-712 digest equals `payer`.

A voucher is cumulative: the second call signs a larger total, not a fresh per-call amount. Replaying the same signature is `402` with `error: "stale"`. The provider calls `settle(tabId, cumulative, sig)` every `SETTLE_EVERY` accepted calls (default 5), so N HTTP calls become one transaction.

## tPOT: 14 decimals on Substrate, 18 on the EVM RPC

| Layer | Unit | 1 tPOT |
|---|---|---|
| Substrate balances, `Revive.call` `value` | planck | 10^14 |
| EVM `msg.value`, AgentTab `deposit` / `claimed`, MetaMask | wei | 10^18 |
| Conversion | wei per planck | 10^4 |

The deployer balance on `https://test-evm-rpc-v3.portaldot.dev` matches the recorded ~167 tPOT only when the hex balance is divided by 10^18. `sdk` therefore treats AgentTab amounts as wei and converts at the Substrate boundary:

```ts
import { parseTpot, planckToWei, weiToPlanck } from "agenttab-portaldot-sdk";

parseTpot("0.01");            // 10^16 wei — the check-in demo deposit
weiToPlanck(parseTpot("1"));  // 10^14 planck
planckToWei(10n ** 14n);      // 10^18 wei
```

`open{value:}` amounts must be a multiple of 10_000 wei. Anything smaller is not an integer planck, and `buildOpenNativeTab` rejects it.

Reported EVM balance applies that ratio after the existential deposit and revive dust: `eth_getBalance = (free - 10^13) * 10000 + dust`. On spec 3002 the deployer fallback account (`5Fe78D5g5NcrMU2J97UXdQEMU1DSNwgh7knaHirpD8J8th3U`) had `free = 15215275935089184` planck, `reserved = 0`, `frozen = 0`, dust `4660` wei, and existential deposit `10^13` planck (0.1 tPOT). Both `eth_getBalance` and `ReviveApi_balance` were `152052759350891844660`. `substrate/src/probe.ts` checks that identity on every run.

## Substrate entry (same contract)

EVM JSON-RPC and a native `5…` account both enter pallet-revive and execute the deployed `AgentTab` at `0x9a096C216f79e08C2DB95d92F412697D8F1f9329`.

```mermaid
flowchart LR
  EVM["EVM JSON-RPC\neth_call / legacy tx"] --> REV["pallet-revive"]
  ACC["AccountId32\n5…"] --> DRY["ReviveApi_call\nstate_call dry-run"]
  ACC --> EXT["Revive.call\npallet 80, call 1"]
  DRY --> REV
  EXT --> REV
  REV --> TAB["AgentTab.sol"]
  TAB --> POT["native tPOT\ntoken = address 0"]
  TAB --> PRE["Assets ERC-20 precompile\nprefix 0x0001"]
```

`substrate/` encodes both calls. `npm run revive-probe` talks to the live testnet and writes `runs/revive-probe.json`. It uses `state_call`, `eth_call`, and `state_getStorage` only. It does not sign and it does not submit.

What that probe showed at block 148951 (`runs/revive-probe.json` `blockNumber`, spec `portaldot-v3` 3002):

| Check | Result |
|---|---|
| Origin | Deployer fallback `5Fe78…`. `ReviveApi_address` and `ReviveApi_account_id` round-trip the public H160. |
| `remaining(1)` | `ReviveApi_call` and `eth_call` both return `5000000000000000`. |
| `tabs(1)` / `nextId()` | Same bytes as `eth_call`. `nextId` is 3. |
| `Revive.call` bytes | Unsigned SCALE `0x5001…` for `remaining(1)`, weight from that dry-run. Not submitted. |
| `settle` dry-run | Reverted `NotProvider` (`0x3480e2b2`). Tab 1's provider is `0x7F22…`, and this origin is the payer. The contract ran. Nothing was settled. |

Account mapping on this runtime (`AccountId32Mapper`): an eth-derived id is `H160` plus twelve `0xEE` bytes; any other id maps to `keccak256(accountId)[12:]`. Spec 3002 sets `Revive.AutoMap = true`, so `map_account` fails with `AutoMappingEnabled`.

### Optional Assets ERC-20 tab

The Assets pallet is on this testnet, and pallet-revive exposes it as an ERC-20 precompile. Polkadot Hub suffixes `0x0120` / `0x0220` / `0x0320` return empty code here; the live prefix is `0x0001`.

```
bytes 0..4   asset id, big-endian
bytes 4..16  zero
bytes 16..18 0x0001
bytes 18..20 zero
```

Asset id 2 (`TEST`, 18 decimals) is `0x0000000200000000000000000000000000010000`. Its `totalSupply` is `15000000000000000000` from `Assets.Asset(2)`, from `eth_call`, and from `ReviveApi_call`. `name` / `symbol` / `decimals` respond on this runtime. `AssetsPrecompiles.ForeignAssetIdToAssetIndex(2)` is `1`, and prefix `0x0001` with id `1` returns supply `0`, so the foreign index is not what you put in the address. Prefix `0x0002` matches `PoolAssets`, not the tab helper.

```ts
import { buildOpenErc20Tab } from "agenttab-portaldot-sdk";

const call = buildOpenErc20Tab({
  provider: "0x…",
  assetId: 2,
  amount: 1n,
  expiry: 1_893_456_000n,
});
// call.value === 0n; call.token is the precompile. Caller must approve AgentTab first.
```

A `ReviveApi_call` of that `open` from the deployer fallback reverted with empty returndata after 183504695 gas. No ERC-20 tab was opened. The HTTP 402 gateway still prices only native tPOT.

## Opening a tab, then paying

1. Fund the **mapped SS58 account** (Developer → reviveApi → accountId in the node console). The H160 from the same key is not the Substrate account that holds tPOT.
2. `openNativeTab` sends a **legacy** transaction whose gas limit is `eth_estimateGas`. pallet-revive packs weight and storage deposit into that estimate; a default EVM gas limit is rejected.
3. Read `Opened.id` from the receipt (`tabIdFromReceipt`).
4. For each call, sign `cumulative = previous + price` and send `X-AgentTab-Voucher`.
5. The gateway verifies off chain. It settles on chain every N calls, or whenever the provider submits `settleVoucher`.

`CHAIN_MODE=memory` (the default) never touches the RPC. Use it for the 402 dry-run. `CHAIN_MODE=rpc` reads `tabs(id)` from testnet and, when `PROVIDER_PK` is set, submits `settle`.

## What was reused

`src/AgentTab.sol` is a port of the author's MIT AgentTab contract (Celo, October 2026, <https://github.com/zwang1111/agenttab-celo>). The port adds native tabs, `call{value:}` payouts, a reentrancy guard, and existence checks.

The Celo repository's `agent/` process sells the same quote API on **two** rails and depends on `@x402/*` plus a facilitator. None of that code is imported here. `gateway/` and `sdk/` are new and speak only the AgentTab voucher rail, with Portaldot chain id `420420777` and the tPOT decimal split above.

Third-party libraries: forge-std (MIT/Apache-2.0), viem (MIT), hono (MIT). This TypeScript is MIT.
