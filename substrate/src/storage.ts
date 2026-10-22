import { blake2b } from "@noble/hashes/blake2b";
import { concatBytes, encodeU32LE, hexToBytes, twox128 } from "./scale.ts";

function blake2_128(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 16 });
}

function blake2_128Concat(key: Uint8Array): Uint8Array {
  return concatBytes(blake2_128(key), key);
}

export function storageKey(pallet: string, item: string, key?: Uint8Array): Uint8Array {
  const prefix = concatBytes(twox128(pallet), twox128(item));
  return key ? concatBytes(prefix, key) : prefix;
}

/** `Assets.Asset(id)` / `PoolAssets.Asset(id)` — Blake2_128Concat of the u32 id. */
export function assetStorageKey(pallet: "Assets" | "PoolAssets", assetId: number): `0x${string}` {
  return bytesToPrefixedHex(storageKey(pallet, "Asset", blake2_128Concat(encodeU32LE(assetId))));
}

export function assetMetadataKey(assetId: number): `0x${string}` {
  return bytesToPrefixedHex(storageKey("Assets", "Metadata", blake2_128Concat(encodeU32LE(assetId))));
}

/** Identity hasher: the H160 is appended raw. */
export function reviveAccountInfoKey(address: `0x${string}`): `0x${string}` {
  return bytesToPrefixedHex(storageKey("Revive", "AccountInfoOf", hexToBytes(address)));
}

export function systemAccountKey(accountId: Uint8Array): `0x${string}` {
  return bytesToPrefixedHex(storageKey("System", "Account", blake2_128Concat(accountId)));
}

export function foreignIndexKey(assetId: number): `0x${string}` {
  return bytesToPrefixedHex(
    storageKey("AssetsPrecompiles", "ForeignAssetIdToAssetIndex", blake2_128Concat(encodeU32LE(assetId))),
  );
}

function bytesToPrefixedHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

/** `Assets.Asset` details. Supply is the u128 after the four AccountId roles. */
export function decodeAssetSupply(raw: `0x${string}` | null): bigint | null {
  if (!raw || raw === "0x") return null;
  const bytes = hexToBytes(raw);
  if (bytes.length < 128 + 16) throw new Error("asset storage value is shorter than the supply field");
  let supply = 0n;
  for (let i = 0; i < 16; i++) supply |= BigInt(bytes[128 + i]!) << BigInt(i * 8);
  return supply;
}

export function decodeSystemAccount(raw: `0x${string}` | null): {
  free: bigint;
  reserved: bigint;
  frozen: bigint;
} | null {
  if (!raw || raw === "0x") return null;
  const bytes = hexToBytes(raw);
  const u128At = (offset: number) => {
    let value = 0n;
    for (let i = 0; i < 16; i++) value |= BigInt(bytes[offset + i]!) << BigInt(i * 8);
    return value;
  };
  // nonce, consumers, providers, sufficients: four u32s, then AccountData.
  return { free: u128At(16), reserved: u128At(32), frozen: u128At(48) };
}

/** Revive `AccountInfoOf`: variant 1 is EOA followed by a u32 dust amount. */
export function decodeReviveDust(raw: `0x${string}` | null): number | null {
  if (!raw || raw === "0x") return null;
  const bytes = hexToBytes(raw);
  if (bytes[0] !== 1 || bytes.length < 5) return null;
  return bytes[1]! | (bytes[2]! << 8) | (bytes[3]! << 16) | (bytes[4]! << 24);
}

export function decodeMetadata(raw: `0x${string}` | null): {
  name: string;
  symbol: string;
  decimals: number;
} | null {
  if (!raw || raw === "0x") return null;
  const bytes = hexToBytes(raw);
  let pos = 16; // deposit u128
  const readVec = () => {
    const first = bytes[pos++]!;
    const mode = first & 0b11;
    let length: number;
    if (mode === 0) length = first >> 2;
    else if (mode === 1) {
      const second = bytes[pos++]!;
      length = (first | (second << 8)) >> 2;
    } else {
      throw new Error("metadata string is longer than this decoder accepts");
    }
    const text = Buffer.from(bytes.subarray(pos, pos + length)).toString("utf8");
    pos += length;
    return text;
  };
  const name = readVec();
  const symbol = readVec();
  const decimals = bytes[pos]!;
  return { name, symbol, decimals };
}

export function decodeU32(raw: `0x${string}` | null): number | null {
  if (!raw || raw === "0x") return null;
  const bytes = hexToBytes(raw);
  if (bytes.length < 4) return null;
  return bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! * 0x1000000);
}
