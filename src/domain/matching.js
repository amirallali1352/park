const compatibleTypes = Object.freeze({
  tech_request: ["tech_offer"],
  rd_request: ["tech_offer", "business_offer"],
  tech_offer: ["tech_request", "rd_request"],
  business_offer: ["rd_request"]
});

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

export function rankListings(request, listings = []) {
  const allowed = compatibleTypes[request?.type] ?? [];
  return listings
    .filter((listing) => listing.status !== "closed" && allowed.includes(listing.type))
    .map((listing) => {
      const reasons = [];
      const requestCapabilities = new Set((request.capabilities ?? []).map(normalize));
      const requestTags = new Set((request.tags ?? []).map(normalize));
      const capabilityMatches = (listing.capabilities ?? []).filter((item) => requestCapabilities.has(normalize(item)));
      const tagMatches = (listing.tags ?? []).filter((item) => requestTags.has(normalize(item)));
      capabilityMatches.forEach((item) => reasons.push(`capability:${item}`));
      tagMatches.forEach((item) => reasons.push(`tag:${item}`));
      const text = `${listing.title} ${listing.summary}`.toLowerCase();
      const textMatches = [...requestCapabilities, ...requestTags]
        .filter((term) => text.includes(term)).length;
      return {
        ...listing,
        score: capabilityMatches.length * 5 + tagMatches.length * 3 + textMatches,
        reasons
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
