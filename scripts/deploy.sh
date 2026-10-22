#!/usr/bin/env bash
# Deploy AgentTab to Portaldot V3 testnet with the throwaway key in .env (never printed).
# Portaldot pallet-revive eth-rpc requires: legacy txs + eth_estimateGas as --gas-limit
# (forge create defaults often hit Invalid Transaction or OOG).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
RPC=${PORTALDOT_RPC:-https://test-evm-rpc-v3.portaldot.dev}
[ "$(cast chain-id --rpc-url "$RPC")" = "420420777" ] || { echo "wrong chain"; exit 1; }
: "${DEPLOYER_ADDRESS:?set DEPLOYER_ADDRESS in .env}"
: "${PRIVATE_KEY:?set PRIVATE_KEY in .env}"
BAL=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC")
echo "deployer $DEPLOYER_ADDRESS balance $BAL"
[ "$BAL" != "0" ] || { echo "unfunded: send tPOTv3 to the mapped Substrate account (see PLAN.md)"; exit 2; }

forge build >/dev/null
BYTECODE=$(forge inspect src/AgentTab.sol:AgentTab bytecode)
EST=$(cast estimate --rpc-url "$RPC" --from "$DEPLOYER_ADDRESS" --create "$BYTECODE")
GAS_PRICE=$(cast gas-price --rpc-url "$RPC")
echo "estimateGas $EST gasPrice $GAS_PRICE"

# Fee check (python avoids bash 64-bit overflow on huge gas numbers)
python3 - "$BAL" "$EST" "$GAS_PRICE" <<'PY'
import sys
bal, est, price = map(int, sys.argv[1:])
fee = est * price
print(f"maxFee {fee}")
if fee >= bal:
    print(f"insufficient balance for estimate*gasPrice ({fee} >= {bal}); shrink bytecode or fund more", file=sys.stderr)
    sys.exit(3)
PY

OUT=$(cast send --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --legacy \
  --gas-limit "$EST" --gas-price "$GAS_PRICE" --create "$BYTECODE" --json)
# Never echo PRIVATE_KEY; cast --json does not include it
STAMP=$(date +%Y%m%d-%H%M)
echo "$OUT" | tee "runs/deploy-${STAMP}.json"
python3 -c 'import json,sys; d=json.load(sys.stdin); print("AgentTab", d.get("contractAddress") or d.get("deployedTo")); print("tx", d.get("transactionHash"))' <<<"$OUT"
