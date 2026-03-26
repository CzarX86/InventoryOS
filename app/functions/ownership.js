function buildDefaultAccountId(ownerId) {
  if (!ownerId) return null;
  return `acct_${ownerId}`;
}

function buildOwnershipContext(user = null) {
  const ownerId = user?.ownerId || user?.uid || null;
  const defaultAccountId = user?.defaultAccountId || buildDefaultAccountId(ownerId);

  return {
    ownerId,
    defaultAccountId,
  };
}

function applyOwnershipContext(payload = {}, context = {}) {
  return {
    ...payload,
    ownerId: context?.ownerId || null,
    accountId: payload?.accountId || context?.defaultAccountId || null,
  };
}

function hasOwnershipBoundary(payload = {}) {
  return Boolean(payload?.ownerId && payload?.accountId);
}

module.exports = {
  applyOwnershipContext,
  buildDefaultAccountId,
  buildOwnershipContext,
  hasOwnershipBoundary,
};

