#!/usr/bin/env bash
# Dry-run AgentTab from a public Substrate account via pallet-revive.
# Reads testnet RPC. Does not sign or submit. Writes runs/revive-probe.json.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run revive-probe
