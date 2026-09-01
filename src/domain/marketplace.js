export const MarketplaceListingType = Object.freeze({
  TECH_OFFER: "tech_offer",
  TECH_REQUEST: "tech_request",
  RD_REQUEST: "rd_request",
  BUSINESS_OFFER: "business_offer"
});
export const ListingStatus = Object.freeze({ OPEN: "open", CLOSED: "closed" });

export class MarketplaceError extends Error {
  constructor(message, code = "MARKETPLACE_ERROR") {
    super(message);
    this.name = "MarketplaceError";
    this.code = code;
  }
}

export function createListing({
  id, tenantId, type, title, summary, capabilities = [], tags = [], version = 1
} = {}) {
  if (!id || !tenantId || !Object.values(MarketplaceListingType).includes(type) ||
      !title || !summary || !Array.isArray(capabilities) || !Array.isArray(tags)) {
    throw new MarketplaceError("Listing fields and a supported type are required.", "INVALID_LISTING");
  }
  return Object.freeze({
    id, tenantId, type, title, summary,
    capabilities: [...new Set(capabilities)],
    tags: [...new Set(tags)],
    status: ListingStatus.OPEN,
    version,
    createdAt: new Date().toISOString()
  });
}

export function closeListing(listing) {
  if (!listing || listing.status === ListingStatus.CLOSED) {
    throw new MarketplaceError("Listing is already closed.", "LISTING_ALREADY_CLOSED");
  }
  return Object.freeze({ ...listing, status: ListingStatus.CLOSED });
}
