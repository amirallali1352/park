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
import { createAccessToken } from "../security/auth.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { LoginRateLimiter } from "../security/login-rate-limiter.js";
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
import { VoucherError, applyVoucher, createVoucher } from "../domain/voucher.js";
import { InMemoryVoucherRepository } from "../infrastructure/in-memory-voucher-repository.js";
import { CertificationError, createCertification, isCertificationValid } from "../domain/certification.js";
import { InMemoryCertificationRepository } from "../infrastructure/in-memory-certification-repository.js";

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response, status, body) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}

function pilotDashboardHtml() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>STP OS Pilot Dashboard</title>
  <style>
    :root { color-scheme: dark; font-family: Tahoma, Arial, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0d1726; color: #e7eef8; }
    main { width: min(1100px, 100%); margin: 0 auto; padding: 32px 20px; }
    h1 { margin-bottom: 8px; } .muted { color: #9fb0c5; }
    #tenant-form { display: grid; grid-template-columns: 1.2fr 1fr 1fr auto; gap: 8px; margin: 24px 0; }
    input, button { width: 100%; min-width: 0; border: 1px solid #38506d; border-radius: 8px; padding: 10px 12px; font: inherit; }
    input { background: #122239; color: inherit; }
    button { background: #2d83f7; color: white; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(170px,1fr)); gap: 14px; }
    .card { min-width: 0; background: #14263d; border: 1px solid #284665; border-radius: 12px; padding: 18px; }
    .value { font-size: 30px; font-weight: 700; margin-top: 8px; }
    #message { min-height: 24px; }
    .actions { align-items: start; margin-top: 24px; }
    .actions form { display: grid; gap: 10px; margin: 0; }
    .actions h2 { margin: 0 0 4px; font-size: 20px; }
    @media (max-width: 760px) {
      main { padding: 20px 14px; }
      #tenant-form { grid-template-columns: 1fr; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .actions { grid-template-columns: 1fr; }
    }
    @media (max-width: 420px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <p class="muted">Cross-Park Core Facility &amp; B2B Innovation Ecosystem</p>
    <h1>STP OS Pilot Dashboard</h1>
    <p class="muted">Equipment, bookings, samples and tenant KPIs.</p>
    <form id="tenant-form">
      <input id="tenant-id" placeholder="شناسه Tenant، مانند pilot-park-1" required>
      <input id="email" type="email" placeholder="ایمیل مدیر (اختیاری)">
      <input id="password" type="password" placeholder="رمز عبور (اختیاری)">
      <button type="submit">بارگذاری</button>
    </form>
    <p id="message" class="muted">Enter a tenant ID to load data.</p>
    <section class="grid" aria-live="polite">
      <article class="card"><span class="muted">Equipment</span><div id="equipment" class="value">—</div></article>
      <article class="card"><span class="muted">Available equipment</span><div id="available-equipment" class="value">—</div></article>
      <article class="card"><span class="muted">Bookings</span><div id="bookings" class="value">—</div></article>
      <article class="card"><span class="muted">Samples</span><div id="samples" class="value">—</div></article>
      <article class="card"><span class="muted">Utilization (min)</span><div id="utilization" class="value">—</div></article>
      <article class="card"><span class="muted">R&amp;D spend</span><div id="rd-spend" class="value">—</div></article>
    </section>
    <section class="grid actions">
      <form id="equipment-form" class="card">
        <h2>Register Equipment</h2>
        <input name="id" placeholder="شناسه تجهیز" required>
        <input name="name" placeholder="نام، مانند HPLC" required>
        <input name="type" placeholder="نوع، مانند hplc" required>
        <button type="submit">ثبت تجهیز</button>
      </form>
      <form id="sample-form" class="card">
        <h2>Create Sample</h2>
        <input name="id" placeholder="شناسه نمونه" required>
        <input name="name" placeholder="نام نمونه" required>
        <input name="barcode" placeholder="بارکد" required>
        <button type="submit">ثبت نمونه</button>
      </form>
      <form id="booking-form" class="card">
        <h2>Create Booking</h2>
        <input name="id" placeholder="شناسه رزرو" required>
        <input name="equipmentId" placeholder="شناسه تجهیز" required>
        <input name="startAt" type="datetime-local" required>
        <input name="endAt" type="datetime-local" required>
        <button type="submit">ایجاد رزرو</button>
      </form>
    </section>
  </main>
  <script>
    const form = document.querySelector("#tenant-form");
    const message = document.querySelector("#message");
    let accessToken = null;
    const jsonHeaders = () => ({
      "content-type": "application/json",
      "x-tenant-id": document.querySelector("#tenant-id").value.trim(),
      ...(accessToken ? { authorization: "Bearer " + accessToken } : {})
    });
    const formData = (element) => Object.fromEntries(new FormData(element).entries());
    async function postForm(path, element) {
      const response = await fetch(path, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(formData(element))
      });
      if (!response.ok) throw new Error("Operation failed. Check the form and permissions.");
      return response.json();
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const tenantId = document.querySelector("#tenant-id").value.trim();
      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value;
      message.textContent = "Loading…";
      try {
        const headers = { "x-tenant-id": tenantId };
        if (email && password) {
          const login = await fetch("/api/v1/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tenantId, email, password })
          });
          if (!login.ok) throw new Error("Login failed. Check tenant, email and password.");
          const loginData = await login.json();
          accessToken = loginData.accessToken;
          headers.authorization = "Bearer " + accessToken;
        }
        const response = await fetch("/api/v1/pilot/summary", {
          headers
        });
        if (!response.ok) throw new Error("Unable to load tenant data.");
        const data = await response.json();
        document.querySelector("#equipment").textContent = data.equipmentCount;
        document.querySelector("#available-equipment").textContent = data.availableEquipmentCount;
        document.querySelector("#bookings").textContent = data.bookingCount;
        document.querySelector("#samples").textContent = data.sampleCount;
        document.querySelector("#utilization").textContent = data.kpis.utilizationMinutes;
        document.querySelector("#rd-spend").textContent = data.kpis.rdSpend;
        message.textContent = "Loaded tenant: " + data.tenantId;
      } catch (error) {
        message.textContent = error.message;
      }
    });
    for (const [id, path] of [
      ["equipment-form", "/api/v1/equipment"],
      ["sample-form", "/api/v1/samples"],
      ["booking-form", "/api/v1/bookings"]
    ]) {
      document.querySelector("#" + id).addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await postForm(path, event.currentTarget);
          message.textContent = "Operation completed successfully.";
          form.requestSubmit();
        } catch (error) {
          message.textContent = error.message;
        }
      });
    }
  </script>
</body>
</html>`;
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
  if (error instanceof VoucherError) {
    const status = ["VOUCHER_NOT_FOUND", "ESCROW_NOT_FOUND"].includes(error.code) ? 404 :
      ["VOUCHER_EXHAUSTED", "VOUCHER_AMOUNT_EXCEEDED"].includes(error.code) ? 409 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof CertificationError) {
    const status = error.code === "CERTIFICATION_REQUIRED" ? 403 : 400;
    return { status, body: { error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }
  };
}

function requireRoles(claims, authRequired, roles) {
  if (authRequired && !roles.includes(claims?.role)) {
    throw new IdentityError("Role is not allowed for this operation.", "FORBIDDEN");
  }
}

async function saveWithOutbox({
  unitOfWork, tenantId, aggregateRepository, aggregate, event, outboxRepository
}) {
  if (unitOfWork &&
      typeof aggregateRepository.saveInTransaction === "function" &&
      typeof outboxRepository.saveInTransaction === "function") {
    return unitOfWork.run(tenantId, async (client) => {
      const saved = await aggregateRepository.saveInTransaction(client, aggregate);
      await outboxRepository.saveInTransaction(client, event);
      return saved;
    });
  }
  const saved = await aggregateRepository.save(aggregate);
  await outboxRepository.save(event);
  return saved;
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
    voucherRepository = new InMemoryVoucherRepository(),
    unitOfWork = null,
    certificationRepository = new InMemoryCertificationRepository(),
    loginRateLimit = {},
    fileService = encryptionKek ? new EncryptedFileService({
      encryption: new EnvelopeEncryption({ kek: encryptionKek }),
      storage: new InMemoryObjectStorage()
    }) : null
  } = {}
) {
  const loginRateLimiter = loginRateLimit instanceof LoginRateLimiter
    ? loginRateLimit
    : new LoginRateLimiter(loginRateLimit);
  const encryption = encryptionKek ? new EnvelopeEncryption({ kek: encryptionKek }) : null;
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const method = request.method ?? "GET";
      const protectedRoute = url.pathname.startsWith("/api/v1/") &&
        url.pathname !== "/api/v1/auth/login";
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

      if (method === "GET" && url.pathname === "/pilot/dashboard") {
        return sendHtml(response, 200, pilotDashboardHtml());
      }

      if (method === "GET" && url.pathname === "/api/v1/pilot/summary") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) {
          return sendJson(response, 401, {
            error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
          });
        }
        const [equipment, bookings, samples] = await Promise.all([
          facilityRepository.listEquipment(tenantId),
          facilityRepository.listBookings(tenantId),
          sampleRepository.listSamples(tenantId)
        ]);
        const snapshot = analytics.snapshot(tenantId);
        const persistedBookingCount = bookings.length;
        const persistedUtilizationMinutes = bookings.reduce((total, booking) => {
          const duration = new Date(booking.endAt) - new Date(booking.startAt);
          return total + (Number.isFinite(duration) && duration > 0 ? duration / 60000 : 0);
        }, 0);
        return sendJson(response, 200, {
          tenantId,
          equipmentCount: equipment.length,
          availableEquipmentCount: equipment.filter((item) => item.status === "available").length,
          bookingCount: bookings.length,
          sampleCount: samples.length,
          kpis: {
            bookingCount: Math.max(snapshot.bookingCount, persistedBookingCount),
            utilizationMinutes: Math.max(snapshot.utilizationMinutes, persistedUtilizationMinutes),
            rdSpend: snapshot.rdSpend
          }
        });
      }

      if (url.pathname === "/api/v1/auth/login" && method === "POST") {
        const { email, password, tenantId } = await readJson(request);
        const normalizedEmail = email?.toLowerCase();
        const rateLimitKey = tenantId && normalizedEmail ? `${tenantId}:${normalizedEmail}` : null;
        const rateLimit = rateLimitKey ? loginRateLimiter.check(rateLimitKey) : null;
        if (rateLimit && !rateLimit.allowed) {
          response.setHeader("retry-after", String(rateLimit.retryAfterSeconds));
          return sendJson(response, 429, {
            error: {
              code: "LOGIN_RATE_LIMITED",
              message: "Too many login attempts. Try again later."
            }
          });
        }
        const user = normalizedEmail && tenantId
          ? await repository.findUserByEmail(normalizedEmail, tenantId)
          : null;
        const valid = user?.passwordHash
          ? await verifyPassword(password, user.passwordHash)
          : false;
        if (!valid) {
          if (rateLimitKey) loginRateLimiter.recordFailure(rateLimitKey);
          if (tenantId && normalizedEmail) {
            await auditRepository.append(createAuditEvent({
              id: randomUUID(), tenantId, actorId: normalizedEmail,
              action: "auth.login.failed", resourceType: "user", resourceId: normalizedEmail,
              payload: { email: normalizedEmail, reason: "invalid_credentials" }
            }));
          }
          throw new AuthError("Email or password is invalid.", "INVALID_CREDENTIALS");
        }
        if (rateLimitKey) loginRateLimiter.reset(rateLimitKey);
        const accessToken = createAccessToken(
          {
            sub: user.id,
            tenantId: user.tenantId,
            role: user.role,
            ...(authIssuer ? { iss: authIssuer } : {}),
            ...(authAudience ? { aud: authAudience } : {})
          },
          { secret: authSecret }
        );
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId: user.tenantId, actorId: user.id,
          action: "auth.login.succeeded", resourceType: "user", resourceId: user.id,
          payload: { email: user.email }
        }));
        return sendJson(response, 200, {
          accessToken,
          tokenType: "Bearer",
          expiresIn: 3600,
          user: {
            id: user.id, tenantId: user.tenantId, email: user.email, role: user.role
          }
        });
      }

      if (url.pathname === "/api/v1/auth/me" && method === "GET") {
        if (!claims) throw new AuthError("Bearer access token is required.", "AUTH_REQUIRED");
        return sendJson(response, 200, {
          user: {
            id: claims.sub,
            tenantId: claims.tenantId,
            role: claims.role,
            ...(claims.email ? { email: claims.email } : {})
          }
        });
      }

      if (url.pathname === "/api/v1/analytics/kpis" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, analytics.snapshot(tenantId));
      }

      if (url.pathname === "/api/v1/finance/escrows" && method === "POST") {
        requireRoles(claims, authRequired, ["park_admin", "tenant_admin"]);
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const escrow = createEscrow({ ...(await readJson(request)), tenantId });
        const escrowEvent = createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.ESCROW_CREATED,
          aggregateId: escrow.id, payload: escrow
        });
        await saveWithOutbox({
          unitOfWork, tenantId, aggregateRepository: financeRepository,
          aggregate: escrow, event: escrowEvent, outboxRepository
        });
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

      if (url.pathname === "/api/v1/finance/vouchers" && method === "POST") {
        requireRoles(claims, authRequired, ["park_admin", "tenant_admin"]);
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const voucher = createVoucher({ ...(await readJson(request)), tenantId });
        const voucherEvent = createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.VOUCHER_ISSUED,
          aggregateId: voucher.id, payload: voucher
        });
        await saveWithOutbox({
          unitOfWork, tenantId, aggregateRepository: voucherRepository,
          aggregate: voucher, event: voucherEvent, outboxRepository
        });
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "voucher.created", resourceType: "voucher", resourceId: voucher.id,
          payload: voucher
        }));
        return sendJson(response, 201, voucher);
      }

      if (url.pathname === "/api/v1/finance/vouchers" && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200, await voucherRepository.list(tenantId));
      }

      const voucherApplyMatch = url.pathname.match(
        /^\/api\/v1\/finance\/escrows\/([^/]+)\/apply-voucher$/
      );
      if (voucherApplyMatch && method === "POST") {
        requireRoles(claims, authRequired, ["park_admin", "tenant_admin"]);
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        const { voucherId, amount } = await readJson(request);
        const escrow = await financeRepository.find(tenantId, voucherApplyMatch[1]);
        if (!escrow) throw new VoucherError("Escrow was not found.", "ESCROW_NOT_FOUND");
        const voucher = await voucherRepository.find(tenantId, voucherId);
        if (!voucher) throw new VoucherError("Voucher was not found.", "VOUCHER_NOT_FOUND");
        if (voucher.beneficiaryId !== escrow.payerId && voucher.beneficiaryId !== escrow.payeeId) {
          throw new VoucherError("Voucher beneficiary is not a party to the escrow.", "VOUCHER_BENEFICIARY_MISMATCH");
        }
        if (voucher.currency !== escrow.currency) {
          throw new VoucherError("Voucher currency must match the escrow currency.", "VOUCHER_CURRENCY_MISMATCH");
        }
        const actorId = claims?.sub ?? tenantId;
        const result = applyVoucher(voucher, {
          escrowId: escrow.id,
          amount: Number(amount),
          actorId
        });
        const voucherEvent = createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.VOUCHER_APPLIED,
          aggregateId: voucher.id,
          payload: {
            voucherId: voucher.id, escrowId: escrow.id,
            appliedAmount: result.appliedAmount, remainingAmount: result.remainingAmount,
            status: result.voucher.status, actorId
          }
        });
        await saveWithOutbox({
          unitOfWork, tenantId, aggregateRepository: voucherRepository,
          aggregate: result.voucher, event: voucherEvent, outboxRepository
        });
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId,
          action: "voucher.applied", resourceType: "voucher", resourceId: voucher.id,
          payload: { escrowId: escrow.id, appliedAmount: result.appliedAmount, remainingAmount: result.remainingAmount }
        }));
        return sendJson(response, 200, { ...result, escrow });
      }

      const escrowActionMatch = url.pathname.match(/^\/api\/v1\/finance\/escrows\/([^/]+)\/(approve|release)$/);
      if (escrowActionMatch && method === "POST") {
        requireRoles(claims, authRequired, ["park_admin", "tenant_admin"]);
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
        const escrowEvent = createDomainEvent({
          id: randomUUID(), tenantId,
          type: escrowActionMatch[2] === "approve"
            ? DomainEventType.ESCROW_APPROVED
            : DomainEventType.ESCROW_RELEASED,
          aggregateId: updated.id, payload: updated
        });
        await saveWithOutbox({
          unitOfWork, tenantId, aggregateRepository: financeRepository,
          aggregate: updated, event: escrowEvent, outboxRepository
        });
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
        const payload = await readJson(request);
        const user = createUser({ ...payload, tenantId });
        const passwordHash = payload.password ? await hashPassword(payload.password) : undefined;
        const storedUser = passwordHash ? { ...user, passwordHash } : user;
        await repository.saveUser(storedUser);
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

      const certificationMatch = url.pathname.match(
        /^\/api\/v1\/equipment\/([^/]+)\/certifications$/
      );
      if (certificationMatch && method === "POST") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        requireRoles(claims, authRequired, ["park_admin", "tenant_admin"]);
        const certification = createCertification({
          ...(await readJson(request)),
          equipmentId: certificationMatch[1],
          tenantId
        });
        await certificationRepository.save(certification);
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "equipment.certification.created", resourceType: "certification",
          resourceId: certification.id, payload: certification
        }));
        return sendJson(response, 201, certification);
      }

      if (certificationMatch && method === "GET") {
        const tenantId = claims?.tenantId ?? request.headers["x-tenant-id"];
        if (!tenantId) return sendJson(response, 401, {
          error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
        });
        return sendJson(response, 200,
          await certificationRepository.list(tenantId, certificationMatch[1]));
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
        const equipment = (await facilityRepository.listEquipment(tenantId))
          .find((item) => item.id === booking.equipmentId);
        if (equipment?.accessModel === "certified_self_service" &&
            !(await certificationRepository.findValid(tenantId, booking.equipmentId, booking.userId))) {
          throw new CertificationError(
            "A valid equipment certification is required.", "CERTIFICATION_REQUIRED"
          );
        }
        const bookingEvent = createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.BOOKING_CONFIRMED,
          aggregateId: booking.id, payload: booking
        });
        await saveWithOutbox({
          unitOfWork, tenantId, aggregateRepository: {
            save: (aggregate) => facilityRepository.saveBooking(aggregate),
            saveInTransaction: (client, aggregate) =>
              facilityRepository.saveBookingInTransaction(client, aggregate)
          },
          aggregate: booking, event: bookingEvent, outboxRepository
        });
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? booking.userId,
          action: "booking.created", resourceType: "booking", resourceId: booking.id,
          payload: booking
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
        const maintenanceEvent = createDomainEvent({
          id: randomUUID(), tenantId, type: DomainEventType.MAINTENANCE_SCHEDULED,
          aggregateId: window.id, payload: window
        });
        await saveWithOutbox({
          unitOfWork, tenantId, aggregateRepository: {
            save: (aggregate) => facilityRepository.saveMaintenance(aggregate),
            saveInTransaction: (client, aggregate) =>
              facilityRepository.saveMaintenanceInTransaction(client, aggregate)
          },
          aggregate: window, event: maintenanceEvent, outboxRepository
        });
        await auditRepository.append(createAuditEvent({
          id: randomUUID(), tenantId, actorId: claims?.sub ?? "system",
          action: "maintenance.scheduled", resourceType: "maintenance", resourceId: window.id,
          payload: window
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
        if (event.action === "received") {
          const sampleEvent = createDomainEvent({
            id: randomUUID(), tenantId, type: DomainEventType.SAMPLE_RECEIVED,
            aggregateId: event.sampleId, payload: event
          });
          await saveWithOutbox({
            unitOfWork, tenantId, aggregateRepository: {
              save: (aggregate) => sampleRepository.saveCustodyEvent(aggregate),
              saveInTransaction: (client, aggregate) =>
                sampleRepository.saveCustodyEventInTransaction(client, aggregate)
            },
            aggregate: event, event: sampleEvent, outboxRepository
          });
          await auditRepository.append(createAuditEvent({
            id: randomUUID(), tenantId, actorId: claims?.sub ?? event.actorId,
            action: "sample.received", resourceType: "sample", resourceId: event.sampleId,
            payload: event
          }));
        } else {
          await sampleRepository.saveCustodyEvent(event);
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
