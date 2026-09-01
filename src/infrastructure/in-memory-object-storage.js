export class InMemoryObjectStorage {
  #objects = new Map();

  async put(bucket, key, content) {
    this.#objects.set(`${bucket}/${key}`, Buffer.from(content));
  }

  async get(bucket, key) {
    const content = this.#objects.get(`${bucket}/${key}`);
    if (!content) return null;
    return Buffer.from(content);
  }

  async delete(bucket, key) {
    this.#objects.delete(`${bucket}/${key}`);
  }
}
