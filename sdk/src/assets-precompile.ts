import { getAddress, type Address } from "viem";

/**
 * ERC-20 precompile for the Assets pallet on Portaldot V3 testnet.
 *
 * pallet-revive's `AddressMatcher::Prefix` matches
 * `xxxxxxxx000000000000000000000000pppp0000`, where `pppp` is a big-endian u16
 * at bytes 16..18 and bytes 18..20 stay zero (reserved for builtins).
 * The first four bytes are the Assets pallet id, not the `AssetsPrecompiles`
 * foreign-index.
 *
 * Live check (spec 3002): prefix `0x0001` + asset id 2 returns `totalSupply`
 * `15000000000000000000`, the same integer as `Assets.Asset(2).supply`, and
 * `name` / `symbol` / `decimals` return "test asset" / "TEST" / 18.
 * Prefix `0x0002` is PoolAssets (id 0 supply matches). Polkadot Hub suffixes
 * `0x0120` / `0x0220` / `0x0320` return empty code on this testnet.
 */
export const ASSETS_ERC20_PREFIX = 0x0001;

/** Second precompile instance. Reads line up with `PoolAssets`, not `Assets`. */
export const POOL_ASSETS_ERC20_PREFIX = 0x0002;

const UINT32_MAX = 0xffff_ffffn;

export function assetsErc20Precompile(assetId: number | bigint, prefix: number = ASSETS_ERC20_PREFIX): Address {
  const id = BigInt(assetId);
  if (id < 0n || id > UINT32_MAX) throw new Error("asset id must fit in uint32");
  if (!Number.isInteger(prefix) || prefix <= 0 || prefix > 0xffff) {
    throw new Error("precompile prefix must be a non-zero u16");
  }
  const bytes = new Uint8Array(20);
  bytes[0] = Number((id >> 24n) & 0xffn);
  bytes[1] = Number((id >> 16n) & 0xffn);
  bytes[2] = Number((id >> 8n) & 0xffn);
  bytes[3] = Number(id & 0xffn);
  bytes[16] = (prefix >> 8) & 0xff;
  bytes[17] = prefix & 0xff;
  return getAddress(`0x${Buffer.from(bytes).toString("hex")}`);
}
