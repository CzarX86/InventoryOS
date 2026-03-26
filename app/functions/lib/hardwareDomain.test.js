"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardwareDomain_1 = require("./hardwareDomain");
const ownershipContext = {
    ownerId: "user-123",
    defaultAccountId: "acct_user-123",
};
describe("functions hardwareDomain helpers", () => {
    it("creates catalog and inventory records with the expected canonical shape", () => {
        const catalogItem = (0, hardwareDomain_1.createCatalogItemRecord)({
            type: "Servo Motor",
            brand: "Yaskawa",
            model: "SGM7J",
            partNumber: "SGM7J-04AFC6S",
            quantityOnHand: 0,
        }, ownershipContext);
        const inventoryItem = (0, hardwareDomain_1.createInventoryItemRecord)({
            catalogItemId: "catalog-1",
            legacyInventoryItemId: "inventory-1",
        }, ownershipContext);
        expect(hardwareDomain_1.HARDWARE_COLLECTIONS.inventoryItems).toBe("inventory_items");
        expect((0, hardwareDomain_1.buildCatalogItemCanonicalKey)({
            type: "Servo Motor",
            brand: "Yaskawa",
            model: "SGM7J",
            partNumber: "SGM7J-04AFC6S",
        })).toBe("SERVO MOTOR|YASKAWA|SGM7J|SGM7J-04AFC6S");
        expect(catalogItem).toEqual(expect.objectContaining({
            type: "catalog_item",
            itemType: "Servo Motor",
            legacyType: "Servo Motor",
        }));
        expect(inventoryItem).toEqual(expect.objectContaining({
            type: "inventory_item",
        }));
    });
    it("creates installed base, maintenance and relationship records with recommendation filter", () => {
        const installedBase = (0, hardwareDomain_1.createInstalledBaseRecord)({
            crmAccountId: "crm-account-1",
        }, ownershipContext);
        const maintenanceRule = (0, hardwareDomain_1.createMaintenanceRuleRecord)({
            catalogItemId: "catalog-1",
            recommendedIntervalDays: 90,
        }, ownershipContext);
        const relationship = (0, hardwareDomain_1.createItemRelationshipRecord)({
            sourceCatalogItemId: "catalog-1",
            relatedCatalogItemId: "catalog-2",
            isServiceable: true,
            isSupportedByBusiness: true,
        }, ownershipContext);
        expect(installedBase.type).toBe("installed_base_item");
        expect(maintenanceRule.type).toBe("maintenance_rule");
        expect(relationship.type).toBe("item_relationship");
        expect((0, hardwareDomain_1.canRecommendItemRelationship)(relationship)).toBe(true);
    });
});
//# sourceMappingURL=hardwareDomain.test.js.map