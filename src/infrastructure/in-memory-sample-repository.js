import { SampleError } from "../domain/sample.js";

export class InMemorySampleRepository {
  #samples = new Map();
  #events = new Map();

  async saveSample(sample) {
    const duplicate = [...this.#samples.values()].find(
      (candidate) => candidate.tenantId === sample.tenantId &&
        candidate.barcode === sample.barcode && candidate.id !== sample.id
    );
    if (duplicate) throw new SampleError("Barcode is already used in this tenant.", "DUPLICATE_BARCODE");
    this.#samples.set(sample.id, sample);
    return sample;
  }

  async listSamples(tenantId) {
    return [...this.#samples.values()].filter((sample) => sample.tenantId === tenantId);
  }

  async findSample(tenantId, sampleId) {
    const sample = this.#samples.get(sampleId);
    return sample?.tenantId === tenantId ? sample : null;
  }

  async saveCustodyEvent(event) {
    const sample = await this.findSample(event.tenantId, event.sampleId);
    if (!sample) throw new SampleError("Sample does not belong to this tenant.", "SAMPLE_ACCESS_DENIED");
    const events = this.#events.get(event.sampleId) ?? [];
    events.push(event);
    this.#events.set(event.sampleId, events);
    return event;
  }

  async listCustodyEvents(tenantId, sampleId) {
    const sample = await this.findSample(tenantId, sampleId);
    if (!sample) throw new SampleError("Sample does not belong to this tenant.", "SAMPLE_ACCESS_DENIED");
    return this.#events.get(sampleId) ?? [];
  }
}
