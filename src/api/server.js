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
import { EncryptionError, EnvelopeEncryption } from "../security/encryption.js";
import { EncryptedFileService } from "../security/encrypted-file-service.js";
import { InMemoryObjectStorage } from "../infrastructure/in-memory-object-storage.js";
import { LegalError, createContract, signContract } from "../domain/legal.js";
import { InMemoryLegalRepository } from "../infrastructure/in-memory-legal-repository.js";
import { DigitalSignatureError } from "../security/digital-signature.js";
import { MarketplaceError, closeListing, createListing } from "../domain/marketplace.js";
import { InMemoryMarketplaceRepository } from "../infrastructure/in-memory-marketplace-repository.js";
import { rankListings } from "../domain/matching.js";
import { ConsortiumError, createConsortium } from "../domain/consortium.js";
import { InMemoryConsortiumRepository } from "../infrastructure/in-memory-consortium-repository.js";
import { EmbeddingError } from "../search/embedding.js";
import { AnalyticsAggregator } from "../analytics/aggregator.js";
import { FinanceError, approveEscrow, createEscrow, releaseEscrow } from "../domain/finance.js";
import { InMemoryFinanceRepository } from "../infrastructure/in-memory-finance-repository.js";

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
  if (error instanceof EncryptionError) {
    const status = ["CONTEXT_MISMATCH", "TENANT_ACCESS_DENIED"].includes(error.code) ? 403 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error?.name === "EncryptedFileError") {
    const status = error.code === "FILE_NOT_FOUND" ? 404 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof LegalError) {
    const status = error.code === "LEGAL_WRAPPER_REQUIRED" ? 412 :
      error.code === "CONTRACT_NOT_FOUND" ? 404 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof DigitalSignatureError) {
    return { status: 400, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof MarketplaceError) {
    const status = error.code === "LISTING_NOT_FOUND" ? 404 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof ConsortiumError) {
    return { status: 400, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof EmbeddingError) {
    return { status: 400, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof FinanceError) {
    const status = error.code === "ESCROW_NOT_FOUND" ? 404 :
      error.code === "ESCROW_ALREADY_RELEASED" ? 409 : 400;
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
    authAudience = process.env.AUTH_AUDIENCE,
    facilityRepository = new InMemoryFacilityRepository(),
    sampleRepository = new InMemorySampleRepository(),
    outboxRepository = new InMemoryOutboxRepository(),
    auditRepository = new InMemoryAuditRepository(),
    encryptionKek = process.env.ENCRYPTION_KEK,
    legalRepository = new InMemoryLegalRepository(),
    requireLegalWrapper = false,
    signatureProvider = null,
    marketplaceRepository = new InMemoryMarketplaceRepository(),
    consortiumRepository = new InMemoryConsortiumRepository(),
    embeddingProvider = null,
    vectorIndex = null,
    analytics = new AnalyticsAggregator(),
    analyticsSink = null,
    financeRepository = new InMemoryFinanceRepository(),
    fileService = encryptionKek ? new EncryptedFileService({
      encryption: new EnvelopeEncryption({ kek: encryptionKek }),
      storage: new InMemoryObjectStorage()
    }) : null
  } = {}
) {
  const encryption = encryptionKek ? new EnvelopeEncryption({ kek: encryptionKek }) : null;
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

      if (url.pathname === "/api/v1/analytics/kpis" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, analytics.snapshot(tenantId));
      }

      if (url.pathname === "/api/v1/finance/escrows" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const escrow = createEscrow({ ...(await readJson(request)), tenantId });
        await financeRepository.save(escrow);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "escrow.created", resourceType: "escrow", resourceId: escrow.id,
          payload: escrow
        }));
        return sendJson(response, 201, escrow);
      }

      if (url.pathname === "/api/v1/finance/escrows" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await financeRepository.list(tenantId));
      }

      const escrowActionMatch = url.pathname.match(/^\/api\/v1\/finance\/escrows\/([^/]+)\/(approve|release)$/);
      if (escrowActionMatch && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const escrow = await financeRepository.find(tenantId, escrowActionMatch[1]);
        if (!escrow) throw new FinanceError("Escrow was not found.", "ESCROW_NOT_FOUND");
        const actorId = claims?.sub ?? tenantId;
        const updated = escrowActionMatch[2] === "approve"
          ? approveEscrow(escrow, { actorId })
          : releaseEscrow(escrow, { actorId });
        await financeRepository.save(updated);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId,
          action: `escrow.${escrowActionMatch[2]}d`, resourceType: "escrow",
          resourceId: updated.id, payload: updated
        }));
        return sendJson(response, 200, updated);
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
        const analyticsEvent = {
          id: randomUUID(), tenantId, type: DomainEventType.BOOKING_CONFIRMED,
          occurredAt: booking.createdAt, payload: {
            equipmentId: booking.equipmentId,
            durationMinutes: (new Date(booking.endAt) - new Date(booking.startAt)) / 60000,
            amount: booking.amount ?? 0
          }
        };
        analytics.consume(analyticsEvent);
        if (analyticsSink) await analyticsSink.write(analyticsEvent);
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

      if (url.pathname === "/api/v1/files/encrypt" && method === "POST") {
        if (!encryption) throw new EncryptionError("ENCRYPTION_KEK is not configured.", "ENCRYPTION_NOT_CONFIGURED");
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const { objectId, contentBase64 } = await readJson(request);
        if (typeof contentBase64 !== "string") {
          throw new EncryptionError("contentBase64 is required.", "INVALID_CONTENT");
        }
        const envelope = encryption.encrypt(Buffer.from(contentBase64, "base64"), {
          tenantId,
          objectId
        });
        return sendJson(response, 201, envelope);
      }

      if (url.pathname === "/api/v1/files/decrypt" && method === "POST") {
        if (!encryption) throw new EncryptionError("ENCRYPTION_KEK is not configured.", "ENCRYPTION_NOT_CONFIGURED");
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const { envelope } = await readJson(request);
        const plaintext = encryption.decrypt(envelope, { tenantId, objectId: envelope?.objectId });
        return sendJson(response, 200, { contentBase64: plaintext.toString("base64") });
      }

      if (url.pathname === "/api/v1/files" && method === "POST") {
        if (!fileService) throw new EncryptionError("FILE_STORAGE is not configured.", "ENCRYPTION_NOT_CONFIGURED");
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        if (requireLegalWrapper && !await legalRepository.hasActiveAgreement(tenantId)) {
          throw new LegalError("An active mNDA or MSA is required before data exchange.", "LEGAL_WRAPPER_REQUIRED");
        }
        const { objectId, contentType, contentBase64 } = await readJson(request);
        if (typeof contentBase64 !== "string") {
          throw new EncryptionError("contentBase64 is required.", "INVALID_CONTENT");
        }
        return sendJson(response, 201, await fileService.put({
          tenantId,
          objectId,
          contentType,
          content: Buffer.from(contentBase64, "base64")
        }).then(async (metadata) => {
          await auditRepository.append(createAuditEvent({
            id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
            action: "file.created", resourceType: "file", resourceId: objectId,
            payload: metadata
          }));
          return metadata;
        }));
      }

      if (url.pathname === "/api/v1/contracts" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const contract = createContract({ ...(await readJson(request)), tenantId });
        await legalRepository.save(contract);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "contract.created", resourceType: "contract", resourceId: contract.id,
          payload: contract
        }));
        return sendJson(response, 201, contract);
      }

      if (url.pathname === "/api/v1/marketplace/listings" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const listing = createListing({ ...(await readJson(request)), tenantId });
        await marketplaceRepository.save(listing);
        if (embeddingProvider && vectorIndex?.indexListing) {
          const text = [
            listing.title, listing.summary, ...(listing.capabilities ?? []), ...(listing.tags ?? [])
          ].filter(Boolean).join(" ");
          await vectorIndex.indexListing({
            ...listing,
            embedding: await embeddingProvider.embed(text)
          });
        }
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "marketplace.listing.created", resourceType: "listing", resourceId: listing.id,
          payload: listing
        }));
        return sendJson(response, 201, listing);
      }

      if (url.pathname === "/api/v1/marketplace/listings" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await marketplaceRepository.list(tenantId, {
          type: url.searchParams.get("type") ?? undefined,
          tag: url.searchParams.get("tag") ?? undefined,
          status: url.searchParams.get("status") ?? "open"
        }));
      }

      if (url.pathname === "/api/v1/marketplace/match" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const requestListing = await readJson(request);
        if (embeddingProvider && vectorIndex) {
          const text = [
            requestListing.title, requestListing.summary,
            ...(requestListing.capabilities ?? []), ...(requestListing.tags ?? [])
          ].filter(Boolean).join(" ");
          const embedding = await embeddingProvider.embed(text);
          return sendJson(response, 200, await vectorIndex.search({ tenantId, embedding, k: 10 }));
        }
        const candidates = typeof marketplaceRepository.discover === "function"
          ? await marketplaceRepository.discover({ status: "open" })
          : await marketplaceRepository.list(tenantId, { status: "open" });
        return sendJson(response, 200, rankListings(requestListing, candidates));
      }

      if (url.pathname === "/api/v1/marketplace/consortia" && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const consortium = createConsortium({ ...(await readJson(request)), tenantId });
        await consortiumRepository.save(consortium);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "marketplace.consortium.created", resourceType: "consortium",
          resourceId: consortium.id, payload: consortium
        }));
        return sendJson(response, 201, consortium);
      }

      if (url.pathname === "/api/v1/marketplace/consortia" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await consortiumRepository.list(tenantId));
      }

      const closeListingMatch = url.pathname.match(/^\/api\/v1\/marketplace\/listings\/([^/]+)\/close$/);
      if (closeListingMatch && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const listing = await marketplaceRepository.find(tenantId, closeListingMatch[1]);
        if (!listing) throw new MarketplaceError("Listing was not found.", "LISTING_NOT_FOUND");
        const closed = closeListing(listing);
        await marketplaceRepository.save(closed);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "marketplace.listing.closed", resourceType: "listing", resourceId: closed.id,
          payload: closed
        }));
        return sendJson(response, 200, closed);
      }

      if (url.pathname === "/api/v1/contracts" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await legalRepository.list(tenantId));
      }

      const contractSignMatch = url.pathname.match(/^\/api\/v1\/contracts\/([^/]+)\/sign$/);
      if (contractSignMatch && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const contract = await legalRepository.find(tenantId, contractSignMatch[1]);
        if (!contract) throw new LegalError("Contract was not found.", "CONTRACT_NOT_FOUND");
        const signatureRequest = await readJson(request);
        const digitalSignature = signatureProvider
          ? signatureProvider.sign(contract, { partyId: signatureRequest.partyId })
          : undefined;
        const signed = signContract(contract, { ...signatureRequest, digitalSignature });
        await legalRepository.save(signed);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "contract.signed", resourceType: "contract", resourceId: signed.id,
          payload: { partyId: signed.signatures.at(-1).partyId, status: signed.status }
        }));
        return sendJson(response, 200, signed);
      }

      const contractVerifyMatch = url.pathname.match(/^\/api\/v1\/contracts\/([^/]+)\/verify$/);
      if (contractVerifyMatch && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const contract = await legalRepository.find(tenantId, contractVerifyMatch[1]);
        if (!contract) throw new LegalError("Contract was not found.", "CONTRACT_NOT_FOUND");
        const valid = contract.signatures.every((entry) =>
          entry.digitalSignature && signatureProvider?.verify(contract, entry.digitalSignature)
        );
        return sendJson(response, 200, { valid, signatures: contract.signatures.length });
      }

      const fileMatch = url.pathname.match(/^\/api\/v1\/files\/([^/]+)$/);
      if (fileMatch && method === "GET") {
        if (!fileService) throw new EncryptionError("FILE_STORAGE is not configured.", "ENCRYPTION_NOT_CONFIGURED");
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const file = await fileService.get({ tenantId, objectId: fileMatch[1] });
        return sendJson(response, 200, {
          ...file.metadata,
          contentBase64: file.content.toString("base64")
        });
      }

      if (fileMatch && method === "DELETE") {
        if (!fileService) throw new EncryptionError("FILE_STORAGE is not configured.", "ENCRYPTION_NOT_CONFIGURED");
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const metadata = (await fileService.get({ tenantId, objectId: fileMatch[1] })).metadata;
        await fileService.remove({ tenantId, objectId: fileMatch[1] });
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "file.deleted", resourceType: "file", resourceId: fileMatch[1],
          payload: metadata
        }));
        response.writeHead(204);
        return response.end();
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
