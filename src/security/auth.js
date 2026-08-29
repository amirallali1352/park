import { createHmac, timingSafeEqual } from "node:crypto";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export class AuthError extends Error {
  constructor(message, code = "INVALID_ACCESS_TOKEN") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export function createAccessToken(
  claims,
  { secret, now = Math.floor(Date.now() / 1000), ttlSeconds = 3600 } = {}
) {
  if (!secret) throw new Error("AUTH_SECRET is required.");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ ...claims, iat: now, exp: now + ttlSeconds });
  const input = `${header}.${payload}`;
  return `${input}.${sign(input, secret)}`;
}

export function verifyAccessToken(
  token,
  { secret, issuer, audience, now = Math.floor(Date.now() / 1000) } = {}
) {
  if (!secret) throw new Error("AUTH_SECRET is required.");
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) throw new AuthError("Invalid access token.");
  const [encodedHeader, encodedPayload, signature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new AuthError("Invalid access token.");
  }
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new AuthError("Invalid access token.");
  }
  const expected = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new AuthError("Invalid access token.");
  }
  if (!payload.sub || !payload.tenantId || !Number.isInteger(payload.exp) || payload.exp <= now) {
    throw new AuthError("Access token is expired or incomplete.", "ACCESS_TOKEN_EXPIRED");
  }
  if (issuer && payload.iss !== issuer) {
    throw new AuthError("Access token issuer is invalid.", "INVALID_TOKEN_ISSUER");
  }
  if (
    audience &&
    !(payload.aud === audience || (Array.isArray(payload.aud) && payload.aud.includes(audience)))
  ) {
    throw new AuthError("Access token audience is invalid.", "INVALID_TOKEN_AUDIENCE");
  }
  return payload;
}

export function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}
