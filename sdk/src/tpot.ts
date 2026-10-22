/**
 * tPOTv3 unit conversion.
 *
 * Substrate (Balances / Revive.call `value`) counts planck: 1 tPOT = 10^14.
 * The EVM RPC (pallet-revive eth-rpc) reports the same balance in 18-decimal wei,
 * which is what AgentTab stores in `deposit` / `claimed` and what `msg.value` uses.
 *
 * Observed: deployer `0x9e2e…1fDd` balance `0x9145eac436e41e144` is ~167.49 tPOT
 * only when divided by 10^18, matching the post-deploy note of ~167 tPOT.
 * Therefore 1 planck = 10^(18-14) wei = 10_000 wei.
 *
 * Native `open{value:}` amounts must be a multiple of `WEI_PER_PLANCK` or the
 * value cannot be represented as an integer on the Substrate side.
 */

export const SUBSTRATE_DECIMALS = 14;
export const EVM_DECIMALS = 18;
export const WEI_PER_TPOT = 10n ** BigInt(EVM_DECIMALS);
export const PLANCK_PER_TPOT = 10n ** BigInt(SUBSTRATE_DECIMALS);
export const WEI_PER_PLANCK = 10n ** BigInt(EVM_DECIMALS - SUBSTRATE_DECIMALS);

const UINT128_MAX = (1n << 128n) - 1n;
const UINT64_MAX = (1n << 64n) - 1n;

export function assertUint128(value: bigint, label: string): void {
  if (value < 0n || value > UINT128_MAX) throw new Error(`${label} exceeds uint128`);
}

export function assertUint64(value: bigint, label: string): void {
  if (value < 0n || value > UINT64_MAX) throw new Error(`${label} exceeds uint64`);
}

export function assertPlanckAligned(wei: bigint, label = "amount"): void {
  if (wei < 0n || wei % WEI_PER_PLANCK !== 0n) {
    throw new Error(`${label} is not a multiple of ${WEI_PER_PLANCK} wei (1 substrate planck)`);
  }
}

/** Parse a base-10 tPOT string (up to 18 fractional digits) into EVM wei. */
export function parseTpot(amount: string): bigint {
  const s = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`invalid tPOT amount: ${amount}`);
  const [whole, frac = ""] = s.split(".");
  if (frac.length > EVM_DECIMALS) {
    throw new Error(`tPOT amount has more than ${EVM_DECIMALS} fractional digits`);
  }
  const fracPadded = (frac + "0".repeat(EVM_DECIMALS)).slice(0, EVM_DECIMALS);
  return BigInt(whole) * WEI_PER_TPOT + BigInt(fracPadded);
}

/** Format wei as a tPOT decimal string. Truncates; it does not round up. */
export function formatTpot(wei: bigint, maxFrac = 6): string {
  if (wei < 0n) throw new Error("wei is negative");
  if (maxFrac < 0 || maxFrac > EVM_DECIMALS) throw new Error("maxFrac out of range");
  const whole = wei / WEI_PER_TPOT;
  const fracFull = (wei % WEI_PER_TPOT).toString().padStart(EVM_DECIMALS, "0").slice(0, maxFrac);
  const frac = fracFull.replace(/0+$/, "");
  return frac.length ? `${whole.toString()}.${frac}` : whole.toString();
}

export function planckToWei(planck: bigint): bigint {
  if (planck < 0n) throw new Error("planck is negative");
  return planck * WEI_PER_PLANCK;
}

export function weiToPlanck(wei: bigint, mode: "exact" | "floor" = "exact"): bigint {
  if (wei < 0n) throw new Error("wei is negative");
  if (mode === "exact") assertPlanckAligned(wei, "wei");
  return wei / WEI_PER_PLANCK;
}
