import {
  HARDWARE_COLLECTIONS,
  INVENTORY_ITEM_STATUSES,
  ITEM_RELATIONSHIP_TYPES,
  buildCatalogItemCanonicalKey,
  canRecommendItemRelationship,
  createCatalogItemRecord,
  createInstalledBaseRecord,
  createInventoryItemRecord,
  createItemRelationshipRecord,
  createMaintenanceRuleRecord,
} from "./hardwareDomain";

const ownershipContext = {
  ownerId: "user-123",
  defaultAccountId: "acct_user-123",
};

describe("hardwareDomain helpers", () => {
  it("creates catalog and inventory records compatible with the current inventory shape", () => {
    const catalogItem = createCatalogItemRecord({
      type: "INVERSOR DE FREQUÊNCIA",
      brand: "WEG",
      model: "CFW500",
      partNumber: "12345678",
      specifications: "3CV 380V",
      quantityOnHand: 0,
    }, ownershipContext);
    const inventoryItem = createInventoryItemRecord({
      catalogItemId: "catalog-1",
      legacyInventoryItemId: "inventory-1",
      type: "INVERSOR DE FREQUÊNCIA",
      brand: "WEG",
      model: "CFW500",
      partNumber: "12345678",
      specifications: "3CV 380V",
    }, ownershipContext);

    expect(HARDWARE_COLLECTIONS.catalogItems).toBe("catalog_items");
    expect(INVENTORY_ITEM_STATUSES).toContain("IN STOCK");
    expect(buildCatalogItemCanonicalKey({
      type: "inversor de frequência",
      brand: "weg",
      model: "cfw500",
      partNumber: "12345678",
    })).toBe("INVERSOR DE FREQUENCIA|WEG|CFW500|12345678");
    expect(catalogItem).toEqual(expect.objectContaining({
      type: "catalog_item",
      ownerId: "user-123",
      accountId: "acct_user-123",
      itemType: "INVERSOR DE FREQUÊNCIA",
      legacyType: "INVERSOR DE FREQUÊNCIA",
      canonicalKey: "INVERSOR DE FREQUENCIA|WEG|CFW500|12345678",
      quantityOnHand: 0,
      isSellable: true,
      isSupportedByBusiness: true,
    }));
    expect(inventoryItem).toEqual(expect.objectContaining({
      type: "inventory_item",
      legacyInventoryItemId: "inventory-1",
      catalogItemId: "catalog-1",
      itemType: "INVERSOR DE FREQUÊNCIA",
      legacyType: "INVERSOR DE FREQUÊNCIA",
      status: "IN STOCK",
      quantity: 1,
    }));
  });

  it("creates installed base and maintenance rule records tied to CRM accounts", () => {
    const installedBase = createInstalledBaseRecord({
      crmAccountId: "crm-account-1",
      catalogItemId: "catalog-1",
      quantity: 2,
      confidence: 0.82,
    }, ownershipContext);
    const maintenanceRule = createMaintenanceRuleRecord({
      catalogItemId: "catalog-1",
      serviceType: "preventive_maintenance",
      recommendedIntervalDays: 180,
    }, ownershipContext);

    expect(installedBase).toEqual(expect.objectContaining({
      type: "installed_base_item",
      crmAccountId: "crm-account-1",
      quantity: 2,
      confidence: 0.82,
      source: "inferred",
    }));
    expect(maintenanceRule).toEqual(expect.objectContaining({
      type: "maintenance_rule",
      catalogItemId: "catalog-1",
      serviceType: "preventive_maintenance",
      recommendedIntervalDays: 180,
      allowedForRecommendation: true,
      isSupportedByBusiness: true,
    }));
  });

  it("creates item relationships filtered by business context before recommendation", () => {
    const allowedRelationship = createItemRelationshipRecord({
      sourceCatalogItemId: "catalog-1",
      relatedCatalogItemId: "catalog-2",
      relationshipType: "maintenance_related",
      isSellable: false,
      isServiceable: true,
      isSupportedByBusiness: true,
      allowedForRecommendation: true,
    }, ownershipContext);
    const blockedRelationship = createItemRelationshipRecord({
      sourceCatalogItemId: "catalog-1",
      relatedCatalogItemId: "catalog-3",
      relationshipType: "commonly_co_installed",
      isSellable: false,
      isServiceable: false,
      isSupportedByBusiness: false,
      allowedForRecommendation: true,
    }, ownershipContext);

    expect(ITEM_RELATIONSHIP_TYPES).toContain("maintenance_related");
    expect(allowedRelationship).toEqual(expect.objectContaining({
      type: "item_relationship",
      relationshipScope: "business_context",
      relationshipType: "maintenance_related",
    }));
    expect(canRecommendItemRelationship(allowedRelationship)).toBe(true);
    expect(canRecommendItemRelationship(blockedRelationship)).toBe(false);
  });
});
