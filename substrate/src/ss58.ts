import { createHash } from "node:crypto";
import { concatBytes } from "./scale.ts";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      const value = digits[i]! * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  return "1".repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join("");
}

/** SS58 for a 32-byte account id. Portaldot V3 testnet uses prefix 42. */
export function ss58Encode(accountId: Uint8Array, format = 42): string {
  if (accountId.length !== 32) throw new Error("ss58 encode expects AccountId32");
  if (format < 0 || format >= 64) throw new Error("only a single-byte ss58 prefix is encoded here");
  const payload = concatBytes(Uint8Array.of(format), accountId);
  const checksum = createHash("blake2b512")
    .update(Buffer.concat([Buffer.from("SS58PRE"), Buffer.from(payload)]))
    .digest()
    .subarray(0, 2);
  return base58Encode(concatBytes(payload, checksum));
}
