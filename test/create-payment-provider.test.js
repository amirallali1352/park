import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentProvider } from "../src/infrastructure/create-payment-provider.js";

test("creates the configured memory payment provider", () => {
  const provider = createPaymentProvider({ providerName: "memory" });
  assert.equal(provider.name, "memory");
});

test("fails closed for unsupported payment providers", () => {
  assert.throws(
    () => createPaymentProvider({ providerName: "unknown" }),
    /Unsupported payment provider/
  );
});
