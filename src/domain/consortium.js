export class ConsortiumError extends Error {
  constructor(message, code = "CONSORTIUM_ERROR") {
    super(message);
    this.name = "ConsortiumError";
    this.code = code;
  }
}

export function createConsortium({
  id, tenantId, requestId, grantProgram, members
} = {}) {
  if (!id || !tenantId || !requestId || !grantProgram || !Array.isArray(members) || members.length < 2) {
    throw new ConsortiumError("A consortium needs a request and at least two members.", "INVALID_CONSORTIUM");
  }
  const ids = members.map((member) => member.tenantId);
  if (new Set(ids).size !== ids.length) {
    throw new ConsortiumError("Consortium members must be unique.", "DUPLICATE_CONSORTIUM_MEMBER");
  }
  if (ids.includes(tenantId)) {
    throw new ConsortiumError("Owner tenant cannot be a consortium member.", "INVALID_CONSORTIUM_MEMBER");
  }
  return Object.freeze({
    id, tenantId, requestId, grantProgram,
    members: members.map((member) => ({
      tenantId: member.tenantId,
      role: member.role,
      capabilities: [...new Set(member.capabilities ?? [])]
    })),
    status: "draft",
    createdAt: new Date().toISOString()
  });
}
