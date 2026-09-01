import assert from "node:assert/strict";
import test from "node:test";
import { createConsortium } from "../src/domain/consortium.js";

test("forms a draft consortium from an R&D request and qualified members", () => {
  const consortium = createConsortium({
    id: "consortium-1",
    tenantId: "park-1",
    requestId: "rd-1",
    grantProgram: "TÜBİTAK",
    members: [
      { tenantId: "startup-1", role: "technology_provider", capabilities: ["SEM"] },
      { tenantId: "academic-1", role: "research_partner", capabilities: ["surface-analysis"] }
    ]
  });
  assert.equal(consortium.status, "draft");
  assert.equal(consortium.members.length, 2);
  assert.equal(consortium.grantProgram, "TÜBİTAK");
});

test("rejects duplicate members and incomplete consortiums", () => {
  assert.throws(() => createConsortium({
    id: "bad", tenantId: "park-1", requestId: "rd-1",
    grantProgram: "EU", members: [{ tenantId: "startup-1", role: "partner", capabilities: [] }]
  }), { code: "INVALID_CONSORTIUM" });
  assert.throws(() => createConsortium({
    id: "bad-2", tenantId: "park-1", requestId: "rd-1",
    grantProgram: "EU", members: [
      { tenantId: "startup-1", role: "partner", capabilities: [] },
      { tenantId: "startup-1", role: "partner", capabilities: [] }
    ]
  }), { code: "DUPLICATE_CONSORTIUM_MEMBER" });
});
