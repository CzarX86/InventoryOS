export function buildDefaultAccountId(ownerId: string | null) {
  if (!ownerId) return null;
  return `acct_${ownerId}`;
}

export function buildOwnershipContext(user: any = null) {
  const ownerId = user?.ownerId || user?.uid || null;
  const defaultAccountId = user?.defaultAccountId || buildDefaultAccountId(ownerId);

  return {
    ownerId,
    defaultAccountId,
  };
}

export function applyOwnershipContext(payload: any = {}, context: any = {}) {
  return {
    ...payload,
    ownerId: context?.ownerId || null,
    accountId: payload?.accountId || context?.defaultAccountId || null,
  };
}

export function hasOwnershipBoundary(payload: any = {}) {
  return Boolean(payload?.ownerId && payload?.accountId);
}
