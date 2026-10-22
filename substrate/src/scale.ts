const MASK64 = (1n << 64n) - 1n;
const PRIME64_1 = 0x9e3779b185ebca87n;
const PRIME64_2 = 0xc2b2ae3d27d4eb4fn;
const PRIME64_3 = 0x165667b19e3779f9n;
const PRIME64_4 = 0x85ebca77c2b2ae63n;
const PRIME64_5 = 0x27d4eb2f165667c5n;

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error("odd hex length");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function readU32(data: Uint8Array, offset: number): bigint {
  return (
    BigInt(data[offset]!) |
    (BigInt(data[offset + 1]!) << 8n) |
    (BigInt(data[offset + 2]!) << 16n) |
    (BigInt(data[offset + 3]!) << 24n)
  );
}

function readU64(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i++) value |= BigInt(data[offset + i]!) << BigInt(i * 8);
  return value;
}

function rotl(value: bigint, bits: bigint): bigint {
  return ((value << bits) | (value >> (64n - bits))) & MASK64;
}

/** xxHash64, the primitive behind Substrate's twox128 storage prefix. */
export function xxh64(data: Uint8Array, seed = 0n): bigint {
  const len = data.length;
  let index = 0;
  let hash: bigint;
  if (len >= 32) {
    let acc1 = (seed + PRIME64_1 + PRIME64_2) & MASK64;
    let acc2 = (seed + PRIME64_2) & MASK64;
    let acc3 = seed & MASK64;
    let acc4 = (seed - PRIME64_1) & MASK64;
    const round = (acc: bigint, offset: number) => {
      let lane = readU64(data, offset);
      acc = (acc + ((lane * PRIME64_2) & MASK64)) & MASK64;
      acc = rotl(acc, 31n);
      return (acc * PRIME64_1) & MASK64;
    };
    while (index + 32 <= len) {
      acc1 = round(acc1, index);
      acc2 = round(acc2, index + 8);
      acc3 = round(acc3, index + 16);
      acc4 = round(acc4, index + 24);
      index += 32;
    }
    hash = (rotl(acc1, 1n) + rotl(acc2, 7n) + rotl(acc3, 12n) + rotl(acc4, 18n)) & MASK64;
    const merge = (into: bigint, acc: bigint) => {
      let mixed = (acc * PRIME64_2) & MASK64;
      mixed = rotl(mixed, 31n);
      mixed = (mixed * PRIME64_1) & MASK64;
      into = (into ^ mixed) & MASK64;
      return (into * PRIME64_1 + PRIME64_4) & MASK64;
    };
    hash = merge(hash, acc1);
    hash = merge(hash, acc2);
    hash = merge(hash, acc3);
    hash = merge(hash, acc4);
  } else {
    hash = (seed + PRIME64_5) & MASK64;
  }
  hash = (hash + BigInt(len)) & MASK64;
  while (index + 8 <= len) {
    let lane = readU64(data, index);
    lane = (lane * PRIME64_2) & MASK64;
    lane = rotl(lane, 31n);
    lane = (lane * PRIME64_1) & MASK64;
    hash = (hash ^ lane) & MASK64;
    hash = (rotl(hash, 27n) * PRIME64_1 + PRIME64_4) & MASK64;
    index += 8;
  }
  if (index + 4 <= len) {
    hash = (hash ^ ((readU32(data, index) * PRIME64_1) & MASK64)) & MASK64;
    hash = (rotl(hash, 23n) * PRIME64_2 + PRIME64_3) & MASK64;
    index += 4;
  }
  while (index < len) {
    hash = (hash ^ ((BigInt(data[index]!) * PRIME64_5) & MASK64)) & MASK64;
    hash = (rotl(hash, 11n) * PRIME64_1) & MASK64;
    index += 1;
  }
  hash = (hash ^ (hash >> 33n)) & MASK64;
  hash = (hash * PRIME64_2) & MASK64;
  hash = (hash ^ (hash >> 29n)) & MASK64;
  hash = (hash * PRIME64_3) & MASK64;
  hash = (hash ^ (hash >> 32n)) & MASK64;
  return hash;
}

function writeU64LE(target: Uint8Array, offset: number, value: bigint): void {
  let rest = value & MASK64;
  for (let i = 0; i < 8; i++) {
    target[offset + i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
}

export function twox128(text: string): Uint8Array {
  const data = new TextEncoder().encode(text);
  const out = new Uint8Array(16);
  writeU64LE(out, 0, xxh64(data, 0n));
  writeU64LE(out, 8, xxh64(data, 1n));
  return out;
}

export function encodeCompact(value: bigint): Uint8Array {
  if (value < 0n) throw new Error("compact value is negative");
  if (value < 1n << 6n) return Uint8Array.of(Number(value) << 2);
  if (value < 1n << 14n) {
    const encoded = Number(value << 2n) | 0x01;
    return Uint8Array.of(encoded & 0xff, (encoded >> 8) & 0xff);
  }
  if (value < 1n << 30n) {
    const encoded = Number(value << 2n) | 0x02;
    return Uint8Array.of(encoded & 0xff, (encoded >> 8) & 0xff, (encoded >> 16) & 0xff, (encoded >> 24) & 0xff);
  }
  let width = 0;
  let rest = value;
  while (rest > 0n) {
    width += 1;
    rest >>= 8n;
  }
  if (width < 4) width = 4;
  const out = new Uint8Array(1 + width);
  out[0] = ((width - 4) << 2) | 0x03;
  rest = value;
  for (let i = 0; i < width; i++) {
    out[1 + i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

export function encodeU32LE(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value, true);
  return out;
}

export function encodeU128LE(value: bigint): Uint8Array {
  if (value < 0n || value >= 1n << 128n) throw new Error("u128 out of range");
  const out = new Uint8Array(16);
  let rest = value;
  for (let i = 0; i < 16; i++) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

export class ScaleReader {
  private pos = 0;

  constructor(private readonly data: Uint8Array) {}

  get remaining(): number {
    return this.data.length - this.pos;
  }

  u8(): number {
    const value = this.data[this.pos];
    if (value === undefined) throw new Error("scale reader overflow");
    this.pos += 1;
    return value;
  }

  u32(): number {
    if (this.remaining < 4) throw new Error("scale reader overflow");
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.pos, 4);
    this.pos += 4;
    return view.getUint32(0, true);
  }

  u128(): bigint {
    if (this.remaining < 16) throw new Error("scale reader overflow");
    let value = 0n;
    for (let i = 0; i < 16; i++) value |= BigInt(this.data[this.pos + i]!) << BigInt(i * 8);
    this.pos += 16;
    return value;
  }

  compact(): bigint {
    const first = this.u8();
    const mode = first & 0b11;
    if (mode === 0) return BigInt(first >> 2);
    if (mode === 1) {
      const second = this.u8();
      return BigInt((first | (second << 8)) >> 2);
    }
    if (mode === 2) {
      const b1 = this.u8();
      const b2 = this.u8();
      const b3 = this.u8();
      const value = first + (b1 << 8) + (b2 << 16) + b3 * 0x1000000;
      return BigInt(value >>> 2);
    }
    const width = (first >> 2) + 4;
    let value = 0n;
    for (let i = 0; i < width; i++) value |= BigInt(this.u8()) << BigInt(i * 8);
    return value;
  }

  bytes(): Uint8Array {
    const length = Number(this.compact());
    if (this.remaining < length) throw new Error("scale reader overflow");
    const out = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return out;
  }
}
