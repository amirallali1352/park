import assert from "node:assert/strict";
import test from "node:test";
import { EnvelopeEncryption, EncryptionError } from "../src/security/encryption.js";

test("encrypts and decrypts content with a unique wrapped DEK", () => {
  const encryption = new EnvelopeEncryption({ kek: "a".repeat(32) });
  const encrypted = encryption.encrypt(Buffer.from("trade secret data"), {
    tenantId: "park-1",
    objectId: "file-1"
  });

  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.equal(encrypted.keyWrappingAlgorithm, "aes-256-gcm");
  assert.equal(encrypted.tenantId, "park-1");
  assert.ok(encrypted.wrappedDek);
  assert.ok(encrypted.ciphertext);
  assert.notEqual(encrypted.wrappedDek, encryption.encrypt(Buffer.from("trade secret data"), {
    tenantId: "park-1",
    objectId: "file-2"
  }).wrappedDek);
  assert.deepEqual(encryption.decrypt(encrypted), Buffer.from("trade secret data"));
});

test("rejects tampered ciphertext and an incorrect KEK", () => {
  const encryption = new EnvelopeEncryption({ kek: "b".repeat(32) });
  const encrypted = encryption.encrypt(Buffer.from("secret"), {
    tenantId: "park-1",
    objectId: "file-1"
  });
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}aa` };
  assert.throws(() => encryption.decrypt(tampered), EncryptionError);
  assert.throws(
    () => new EnvelopeEncryption({ kek: "c".repeat(32) }).decrypt(encrypted),
    EncryptionError
  );
});

test("rejects missing encryption context", () => {
  assert.throws(
    () => new EnvelopeEncryption({ kek: "a".repeat(32) }).encrypt(Buffer.from("x"), {}),
    { code: "INVALID_ENCRYPTION_CONTEXT" }
  );
});
