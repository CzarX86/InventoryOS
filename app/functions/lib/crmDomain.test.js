"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crmDomain_1 = require("./crmDomain");
const ownershipContext = {
    ownerId: "user-123",
    defaultAccountId: "acct_user-123",
};
describe("functions crmDomain helpers", () => {
    it("exposes the expected collection names", () => {
        expect(crmDomain_1.CRM_COLLECTIONS.messages).toBe("messages");
        expect(crmDomain_1.CRM_COLLECTIONS.crmEvents).toBe("crm_events");
    });
    it("creates linked CRM records with shared ownership", () => {
        const account = (0, crmDomain_1.createAccountRecord)({ name: "Metalurgica XPTO" }, ownershipContext);
        const contact = (0, crmDomain_1.createContactRecord)({ name: "Carlos" }, ownershipContext);
        const channel = (0, crmDomain_1.createContactChannelRecord)({ contactId: "contact-1", channelValue: "+5511999999999" }, ownershipContext);
        const conversation = (0, crmDomain_1.createConversationRecord)({ contactId: "contact-1", channelId: "channel-1" }, ownershipContext);
        const message = (0, crmDomain_1.createMessageRecord)({ contactId: "contact-1", conversationId: "conversation-1", body: "Quero uma cotacao" }, ownershipContext);
        const opportunity = (0, crmDomain_1.createOpportunityRecord)({ title: "Cotacao ABB" }, ownershipContext);
        const contract = (0, crmDomain_1.createContractRecord)({ opportunityId: "opp-1" }, ownershipContext);
        const crmEvent = (0, crmDomain_1.createCrmEventRecord)({ eventType: "quote_requested", sourceMessageIds: ["msg-1"] }, ownershipContext);
        const task = (0, crmDomain_1.createTaskRecord)({ title: "Retornar cliente" }, ownershipContext);
        const interest = (0, crmDomain_1.createInterestRecord)({ catalogItemId: "catalog-1", sourceMessageIds: ["msg-1"] }, ownershipContext);
        expect(account.ownerId).toBe("user-123");
        expect(contact.accountId).toBe("acct_user-123");
        expect(channel.channelType).toBe("whatsapp");
        expect(conversation.monitoringStatus).toBe("pending_review");
        expect(message.direction).toBe("inbound");
        expect(opportunity.stage).toBe("new");
        expect(contract.status).toBe("active");
        expect(crmEvent.sourceMessageIds).toEqual(["msg-1"]);
        expect(task.assignedToUserId).toBe("user-123");
        expect(interest.catalogItemId).toBe("catalog-1");
    });
});
//# sourceMappingURL=crmDomain.test.js.map