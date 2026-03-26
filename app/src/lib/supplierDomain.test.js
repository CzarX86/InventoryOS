import {
  SUPPLIER_COLLECTIONS,
  QUOTE_REQUEST_STATUSES,
  QUOTE_RESPONSE_STATUSES,
  SUPPLIER_PERFORMANCE_LEVELS,
  createSupplierAccountRecord,
  createSupplierContactRecord,
  createQuoteRequestRecord,
  createQuoteResponseRecord,
  createSupplierPerformanceProfileRecord,
  createProcurementOpportunityRecord,
} from "./supplierDomain";

const ownershipContext = {
  ownerId: "user-123",
  defaultAccountId: "acct_user-123",
};

describe("supplierDomain helpers", () => {
  it("exposes the expected collection map and enums", () => {
    expect(SUPPLIER_COLLECTIONS.supplierAccounts).toBe("supplier_accounts");
    expect(QUOTE_REQUEST_STATUSES).toContain("pending");
    expect(QUOTE_RESPONSE_STATUSES).toContain("received");
    expect(SUPPLIER_PERFORMANCE_LEVELS).toContain("excellent");
  });

  it("creates a coherent supplier account and contact", () => {
    const supplier = createSupplierAccountRecord({ name: "Distribuidora Elétrica" }, ownershipContext);
    const contact = createSupplierContactRecord({
      supplierId: "supplier-1",
      name: "João Vendedor",
      phoneNumber: "+5511888888888",
    }, ownershipContext);

    expect(supplier).toEqual(expect.objectContaining({
      type: "supplier_account",
      ownerId: "user-123",
      accountId: "acct_user-123",
      name: "Distribuidora Elétrica",
      status: "active",
    }));

    expect(contact).toEqual(expect.objectContaining({
      type: "supplier_contact",
      ownerId: "user-123",
      accountId: "acct_user-123",
      supplierId: "supplier-1",
      name: "João Vendedor",
    }));
  });

  it("creates quote request and response records", () => {
    const request = createQuoteRequestRecord({
      supplierId: "supplier-1",
      catalogItemId: "item-1",
      quantity: 10,
    }, ownershipContext);

    const response = createQuoteResponseRecord({
      quoteRequestId: "request-1",
      supplierId: "supplier-1",
      price: 1500.50,
      deliveryDays: 5,
    }, ownershipContext);

    expect(request).toEqual(expect.objectContaining({
      type: "quote_request",
      ownerId: "user-123",
      accountId: "acct_user-123",
      quantity: 10,
      status: "pending",
    }));

    expect(response).toEqual(expect.objectContaining({
      type: "quote_response",
      ownerId: "user-123",
      accountId: "acct_user-123",
      price: 1500.50,
      deliveryDays: 5,
    }));
  });

  it("creates performance profile and procurement opportunity", () => {
    const profile = createSupplierPerformanceProfileRecord({
      supplierId: "supplier-1",
      overallLevel: "good",
      reliabilityScore: 0.95,
    }, ownershipContext);

    const opportunity = createProcurementOpportunityRecord({
      catalogItemId: "item-2",
      title: "Reposição de Inversores",
    }, ownershipContext);

    expect(profile).toEqual(expect.objectContaining({
      type: "supplier_performance_profile",
      ownerId: "user-123",
      accountId: "acct_user-123",
      overallLevel: "good",
      reliabilityScore: 0.95,
    }));

    expect(opportunity).toEqual(expect.objectContaining({
      type: "procurement_opportunity",
      ownerId: "user-123",
      accountId: "acct_user-123",
      status: "open",
    }));
  });
});
