import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  IdentityError,
  assertTenantAccess,
  createTenant,
  createUser
} from "../domain/identity.js";
import { InMemoryIdentityRepository } from "../infrastructure/in-memory-identity-repository.js";
import { InMemoryFacilityRepository } from "../infrastructure/in-memory-facility-repository.js";
import { FacilityError, createBooking, createEquipment, createMaintenanceWindow } from "../domain/facility.js";
import { SampleError, createCustodyEvent, createSample } from "../domain/sample.js";
import { InMemorySampleRepository } from "../infrastructure/in-memory-sample-repository.js";
import { createDomainEvent, DomainEventType } from "../domain/outbox.js";
import { InMemoryOutboxRepository } from "../infrastructure/in-memory-outbox-repository.js";
import { AuthError, bearerToken, verifyAccessToken } from "../security/auth.js";
import { AuditError, createAuditEvent } from "../security/audit.js";
import { InMemoryAuditRepository } from "../infrastructure/in-memory-audit-repository.js";
import { buildMerkleProof, merkleRoot } from "../security/merkle.js";

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
  if (error instanceof FacilityError) {
    const status = ["BOOKING_CONFLICT", "MAINTENANCE_CONFLICT"].includes(error.code) ? 409 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof SampleError) {
    const status = error.code === "DUPLICATE_BARCODE" ? 409 :
      error.code === "SAMPLE_ACCESS_DENIED" ? 403 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof AuditError) {
    return { status: 500, body: { error: { code: error.code, message: error.message } } };
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
    authAudience = process.env.AUTH_AUDIENCE,
    facilityRepository = new InMemoryFacilityRepository(),
    sampleRepository = new InMemorySampleRepository(),
    outboxRepository = new InMemoryOutboxRepository(),
    auditRepository = new InMemoryAuditRepository()
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

      if (url.pathname === "/api/v1/equipment" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        const equipment = createEquipment({ ...(await readJson(request)), tenantId });
        await facilityRepository.saveEquipment(equipment);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "equipment.created", resourceType: "equipment", resourceId: equipment.id,
          payload: equipment
        }));
        return sendJson(response, 201, equipment);
      }

      if (url.pathname === "/api/v1/equipment" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        return sendJson(response, 200, await facilityRepository.listEquipment(tenantId));
      }

      if (url.pathname === "/api/v1/bookings" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        const payload = await readJson(request);
        const booking = createBooking({
          ...payload,
          tenantId,
          userId: claims?.sub ?? payload.userId
        });
        await facilityRepository.saveBooking(booking);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? booking.userId,
          action: "booking.created", resourceType: "booking", resourceId: booking.id,
          payload: booking
        }));
        await outboxRepository.save(createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.BOOKING_CONFIRMED,
          aggregateId: booking.id, payload: booking
        }));
        return sendJson(response, 201, booking);
      }

      if (url.pathname === "/api/v1/bookings" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        return sendJson(response, 200, await facilityRepository.listBookings(tenantId));
      }

      const maintenanceMatch = url.pathname.match(/^\/api\/v1\/equipment\/([^/]+)\/maintenance$/);
      if (maintenanceMatch && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const window = createMaintenanceWindow({
          ...(await readJson(request)),
          equipmentId: maintenanceMatch[1],
          tenantId
        });
        await facilityRepository.saveMaintenance(window);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "maintenance.scheduled", resourceType: "maintenance", resourceId: window.id,
          payload: window
        }));
        await outboxRepository.save(createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.MAINTENANCE_SCHEDULED,
          aggregateId: window.id, payload: window
        }));
        return sendJson(response, 201, window);
      }

      if (maintenanceMatch && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200,
          await facilityRepository.listMaintenance(tenantId, maintenanceMatch[1]));
      }

      if (url.pathname === "/api/v1/samples" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const sample = createSample({ ...(await readJson(request)), tenantId });
        await sampleRepository.saveSample(sample);
        return sendJson(response, 201, sample);
      }

      if (url.pathname === "/api/v1/samples" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await sampleRepository.listSamples(tenantId));
      }

      const custodyMatch = url.pathname.match(/^\/api\/v1\/samples\/([^/]+)\/custody$/);
      if (custodyMatch && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const payload = await readJson(request);
        const event = createCustodyEvent({
          ...payload,
          sampleId: custodyMatch[1],
          tenantId,
          actorId: claims?.sub ?? payload.actorId
        });
        await sampleRepository.saveCustodyEvent(event);
        if (event.action === "received") {
          await auditRepository.append(createAuditEvent({
            id: randomUUID(), tenantId, actorId: claims?.sub ?? event.actorId,
            action: "sample.received", resourceType: "sample", resourceId: event.sampleId,
            payload: event
          }));
          await outboxRepository.save(createDomainEvent({
            id: randomUUID(), tenantId, type: DomainEventType.SAMPLE_RECEIVED,
            aggregateId: event.sampleId, payload: event
          }));
        }
        return sendJson(response, 201, event);
      }

      if (custodyMatch && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200,
          await sampleRepository.listCustodyEvents(tenantId, custodyMatch[1]));
      }

      if (url.pathname === "/api/v1/audit" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await auditRepository.list(tenantId));
      }

      if (url.pathname === "/api/v1/audit/proof" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const events = await auditRepository.list(tenantId);
        const hashes = events.map((event) => event.hash);
        const index = Math.max(0, hashes.length - 1);
        return sendJson(response, 200, {
          event: events[index] ?? null,
          root: merkleRoot(hashes),
          proof: events[index] ? buildMerkleProof(hashes, index) : []
        });
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
