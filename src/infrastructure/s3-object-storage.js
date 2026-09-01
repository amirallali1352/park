export class S3ObjectStorage {
  constructor({ client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = {}) {
    if (!client || typeof client.send !== "function") {
      throw new TypeError("An S3 client is required.");
    }
    this.client = client;
    this.PutObjectCommand = PutObjectCommand;
    this.GetObjectCommand = GetObjectCommand;
    this.DeleteObjectCommand = DeleteObjectCommand;
  }

  async put(bucket, key, content) {
    if (!this.PutObjectCommand) throw new TypeError("PutObjectCommand is required.");
    await this.client.send(new this.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(content)
    }));
  }

  async get(bucket, key) {
    if (!this.GetObjectCommand) throw new TypeError("GetObjectCommand is required.");
    try {
      const result = await this.client.send(new this.GetObjectCommand({
        Bucket: bucket,
        Key: key
      }));
      if (!result.Body) return null;
      const bytes = typeof result.Body.transformToByteArray === "function"
        ? await result.Body.transformToByteArray()
        : result.Body;
      return Buffer.from(bytes);
    } catch (error) {
      if (["NoSuchKey", "NotFound"].includes(error?.name) || error?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(bucket, key) {
    if (!this.DeleteObjectCommand) throw new TypeError("DeleteObjectCommand is required.");
    await this.client.send(new this.DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    }));
  }
}
