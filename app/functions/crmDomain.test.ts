import {
  CRM_COLLECTIONS,
  createAccountRecord,
  createContactChannelRecord,
  createContactRecord,
  createContractRecord,
  createConversationRecord,
  createCrmEventRecord,
  createInterestRecord,
  createMessageRecord,
  createOpportunityRecord,
  createTaskRecord,
} from "./crmDomain";

const ownershipContext = {
  ownerId: "user-123",
  defaultAccountId: "acct_user-123",
};

describe("functions crmDomain helpers", () => {
  it("exposes the expected collection names", () => {
    expect(CRM_COLLECTIONS.messages).toBe("messages");
    expect(CRM_COLLECTIONS.crmEvents).toBe("crm_events");
  });

  it("creates linked CRM records with shared ownership", () => {
    const account = createAccountRecord({ name: "Metalurgica XPTO" }, ownershipContext);
    const contact = createContactRecord({ name: "Carlos" }, ownershipContext);
    const channel = createContactChannelRecord({ contactId: "contact-1", channelValue: "+5511999999999" }, ownershipContext);
    const conversation = createConversationRecord({ contactId: "contact-1", channelId: "channel-1" }, ownershipContext);
    const message = createMessageRecord({ contactId: "contact-1", conversationId: "conversation-1", body: "Quero uma cotacao" }, ownershipContext);
    const opportunity = createOpportunityRecord({ title: "Cotacao ABB" }, ownershipContext);
    const contract = createContractRecord({ opportunityId: "opp-1" }, ownershipContext);
    const crmEvent = createCrmEventRecord({ eventType: "quote_requested", sourceMessageIds: ["msg-1"] }, ownershipContext);
    const task = createTaskRecord({ title: "Retornar cliente" }, ownershipContext);
    const interest = createInterestRecord({ catalogItemId: "catalog-1", sourceMessageIds: ["msg-1"] }, ownershipContext);

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
