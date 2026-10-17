#!/usr/bin/env bash
# Deploy AgentTab to Portaldot V3 testnet with the throwaway key in .env (never printed).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
RPC=${PORTALDOT_RPC:-https://test-evm-rpc-v3.portaldot.dev}
[ "$(cast chain-id --rpc-url "$RPC")" = "420420777" ] || { echo "wrong chain"; exit 1; }
BAL=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC")
echo "deployer $DEPLOYER_ADDRESS balance $BAL"
[ "$BAL" != "0" ] || { echo "unfunded: send tPOTv3 to the mapped Substrate account (see PLAN.md)"; exit 2; }
forge create src/AgentTab.sol:AgentTab --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --json | tee "runs/deploy-$(date +%Y%m%d-%H%M).json"
