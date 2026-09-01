import assert from "node:assert/strict";
import test from "node:test";
import { rankListings } from "../src/domain/matching.js";

const request = {
  type: "tech_request",
  title: "Need SEM material analysis",
  summary: "Certified microscopy and surface characterization",
  capabilities: ["SEM", "surface-analysis"],
  tags: ["materials", "microscopy"]
};

test("ranks compatible offers by semantic feature overlap", () => {
  const ranked = rankListings(request, [
    { id: "weak", type: "tech_offer", title: "Accounting", summary: "Finance", capabilities: [], tags: ["finance"] },
    { id: "strong", type: "tech_offer", title: "SEM lab", summary: "Material microscopy", capabilities: ["SEM"], tags: ["materials"] }
  ]);
  assert.equal(ranked[0].id, "strong");
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].reasons.includes("capability:SEM"));
});

test("filters closed listings and unrelated listing types", () => {
  const ranked = rankListings(request, [
    { id: "closed", type: "tech_offer", status: "closed", title: "SEM", summary: "SEM", capabilities: ["SEM"], tags: [] },
    { id: "request", type: "tech_request", status: "open", title: "SEM", summary: "SEM", capabilities: ["SEM"], tags: [] }
  ]);
  assert.deepEqual(ranked, []);
});
