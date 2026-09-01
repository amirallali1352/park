import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/security/password.js";

test("hashes and verifies a password without storing plaintext", async () => {
  const hash = await hashPassword("Strong-pass-123!");
  assert.notEqual(hash, "Strong-pass-123!");
  assert.equal(await verifyPassword("Strong-pass-123!", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});
