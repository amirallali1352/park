import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { S3ObjectStorage } from "./s3-object-storage.js";

export function createObjectStorage({
  endpoint = process.env.S3_ENDPOINT,
  region = process.env.S3_REGION ?? "us-east-1",
  accessKeyId = process.env.S3_ACCESS_KEY,
  secretAccessKey = process.env.S3_SECRET_KEY,
  forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false"
} = {}) {
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY are required.");
  }
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey }
  });
  return new S3ObjectStorage({
    client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
  });
}
