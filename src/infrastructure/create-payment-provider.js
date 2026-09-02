import { MemoryPaymentProvider } from "./memory-payment-provider.js";

export function createPaymentProvider({
  providerName = process.env.PAYMENT_PROVIDER ?? "memory"
} = {}) {
  if (providerName === "memory") return new MemoryPaymentProvider();
  throw new Error(`Unsupported payment provider: ${providerName}`);
}
