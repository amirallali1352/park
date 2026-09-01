import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new TypeError("Password must contain at least 12 characters.");
  }
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${Buffer.from(derivedKey).toString("base64url")}`;
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;
  const [algorithm, saltText, keyText] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !saltText || !keyText) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    const actual = Buffer.from(await scrypt(password, salt, expected.length));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
