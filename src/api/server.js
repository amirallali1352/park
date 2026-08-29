import { createServer } from "node:http";
import {
  IdentityError,
  assertTenantAccess,
  createTenant,
  createUser
} from "../domain/identity.js";
import { InMemoryIdentityRepository } from "../infrastructure/in-memory-identity-repository.js";
import { AuthError, bearerToken, verifyAccessToken } from "../security/auth.js";

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new IdentityError("Request body must be valid JSON.", "INVALID_JSON");
  }
}

function errorResponse(error) {
  if (error instanceof AuthError) {
    return { status: 401, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof IdentityError) {
    const status = ["TENANT_ACCESS_DENIED", "FORBIDDEN"].includes(error.code) ? 403 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }
  };
}

export function createApiServer(
  repository = new InMemoryIdentityRepository(),
  {
    authRequired = false,
    authSecret = process.env.AUTH_SECRET,
    authIssuer = process.env.AUTH_ISSUER,
    authAudience = process.env.AUTH_AUDIENCE
  } = {}
) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const method = request.method ?? "GET";
      const protectedRoute = url.pathname.startsWith("/api/v1/");
      let claims = null;

      if (authRequired && protectedRoute) {
        const token = bearerToken(request);
        if (!token) throw new AuthError("Bearer access token is required.", "AUTH_REQUIRED");
        claims = verifyAccessToken(token, {
          secret: authSecret,
          issuer: authIssuer,
          audience: authAudience
        });
      }

      if (method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { status: "ok", service: "stp-os" });
      }

      if (url.pathname === "/api/v1/tenants" && method === "POST") {
        if (authRequired && claims?.role !== "park_admin") {
          throw new IdentityError("Park administrator role is required.", "FORBIDDEN");
        }
        const tenant = createTenant(await readJson(request));
        await repository.saveTenant(tenant);
        return sendJson(response, 201, tenant);
      }

      if (url.pathname === "/api/v1/users" && method === "POST") {
        const tenantId = request.headers["x-tenant-id"];
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        if (claims) assertTenantAccess(claims, tenantId);
        const user = createUser({ ...(await readJson(request)), tenantId });
        await repository.saveUser(user);
        return sendJson(response, 201, user);
      }

      if (url.pathname === "/api/v1/users" && method === "GET") {
        const requestedTenantId = request.headers["x-tenant-id"];
        if (claims && requestedTenantId && requestedTenantId !== claims.tenantId) {
          assertTenantAccess(claims, requestedTenantId);
        }
        const tenantId = claims?.tenantId ?? requestedTenantId;
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        const users = await repository.listUsers({ tenantId }, tenantId);
        return sendJson(response, 200, users);
      }

      return sendJson(response, 404, {
        error: { code: "NOT_FOUND", message: "Route not found." }
      });
    } catch (error) {
      const result = errorResponse(error);
      return sendJson(response, result.status, result.body);
    }
  });
}
