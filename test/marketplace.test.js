import assert from "node:assert/strict";
import test from "node:test";
import {
  MarketplaceListingType,
  ListingStatus,
  createListing
} from "../src/domain/marketplace.js";

test("creates a standardized marketplace listing", () => {
  const listing = createListing({
    id: "offer-1",
    tenantId: "startup-1",
    type: MarketplaceListingType.TECH_OFFER,
    title: "High-throughput HPLC analysis",
    summary: "Validated method development and testing",
    capabilities: ["HPLC", "method-development"],
    tags: ["chemistry", "analytics"]
  });
  assert.equal(listing.status, ListingStatus.OPEN);
  assert.equal(listing.type, "tech_offer");
  assert.deepEqual(listing.capabilities, ["HPLC", "method-development"]);
  assert.equal(listing.version, 1);
});

test("accepts all standardized listing types and rejects invalid input", () => {
  for (const type of Object.values(MarketplaceListingType)) {
    assert.equal(createListing({
      id: `listing-${type}`,
      tenantId: "park-1",
      type,
      title: "Valid listing",
      summary: "A useful innovation capability"
    }).type, type);
  }
  assert.throws(() => createListing({
    id: "bad", tenantId: "park-1", type: "unknown",
    title: "Bad", summary: "Bad"
  }), { code: "INVALID_LISTING" });
});
