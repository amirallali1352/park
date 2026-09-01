import assert from "node:assert/strict";
import test from "node:test";
import { createCustodyEvent, createSample } from "../src/domain/sample.js";
import { InMemorySampleRepository } from "../src/infrastructure/in-memory-sample-repository.js";

test("keeps samples and custody events isolated by tenant", async () => {
  const repository = new InMemorySampleRepository();
  const sample = createSample({
    id: "sample-1", tenantId: "park-1", name: "Water",
    barcode: "S-1", submittedBy: "u-1"
  });
  await repository.saveSample(sample);
  await repository.saveSample(createSample({
    id: "sample-2", tenantId: "park-2", name: "Soil",
    barcode: "S-2", submittedBy: "u-2"
  }));
  await repository.saveCustodyEvent(createCustodyEvent({
    id: "event-1", sampleId: "sample-1", tenantId: "park-1",
    actorId: "u-1", action: "received", location: "Lab A"
  }));

  assert.deepEqual((await repository.listSamples("park-1")).map((item) => item.id), ["sample-1"]);
  assert.deepEqual((await repository.listCustodyEvents("park-1", "sample-1")).map((item) => item.id), ["event-1"]);
});

test("rejects duplicate barcodes inside the same tenant", async () => {
  const repository = new InMemorySampleRepository();
  await repository.saveSample(createSample({
    id: "sample-1", tenantId: "park-1", name: "Water",
    barcode: "SAME", submittedBy: "u-1"
  }));

  await assert.rejects(
    () => repository.saveSample(createSample({
      id: "sample-2", tenantId: "park-1", name: "Soil",
      barcode: "SAME", submittedBy: "u-1"
    })),
    { code: "DUPLICATE_BARCODE" }
  );
});
