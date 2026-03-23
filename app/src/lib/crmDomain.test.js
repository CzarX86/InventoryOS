import {
  CONTACT_CHANNEL_TYPES,
  CRM_COLLECTIONS,
  MESSAGE_DIRECTIONS,
  MESSAGE_RELEVANCE_TYPES,
  OPPORTUNITY_STAGES,
  TASK_STATUSES,
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

describe("crmDomain helpers", () => {
  it("exposes the expected collection map and enums", () => {
    expect(CRM_COLLECTIONS.accounts).toBe("accounts");
    expect(CONTACT_CHANNEL_TYPES).toContain("whatsapp");
    expect(MESSAGE_DIRECTIONS).toContain("outbound");
    expect(MESSAGE_RELEVANCE_TYPES).toContain("commercial");
    expect(OPPORTUNITY_STAGES).toContain("won");
    expect(TASK_STATUSES).toContain("pending");
  });

  it("creates a coherent account/contact/channel/conversation/message chain", () => {
    const account = createAccountRecord({ name: "Metalurgica XPTO" }, ownershipContext);
    const contact = createContactRecord({
      accountId: account.accountId,
      name: "Carlos",
      phoneNumber: "+5511999999999",
    }, ownershipContext);
    const channel = createContactChannelRecord({
      accountId: account.accountId,
      contactId: "contact-1",
      channelValue: "+5511999999999",
    }, ownershipContext);
    const conversation = createConversationRecord({
      accountId: account.accountId,
      contactId: "contact-1",
      channelId: "channel-1",
    }, ownershipContext);
    const message = createMessageRecord({
      accountId: account.accountId,
      contactId: "contact-1",
      conversationId: "conversation-1",
      body: "Preciso de um inversor ABB",
      relevanceType: "commercial",
    }, ownershipContext);

    expect(account).toEqual(expect.objectContaining({
      type: "account",
      ownerId: "user-123",
      accountId: "acct_user-123",
      kind: "customer",
    }));
    expect(contact).toEqual(expect.objectContaining({
      type: "contact",
      ownerId: "user-123",
      accountId: "acct_user-123",
      phoneNumber: "+5511999999999",
    }));
    expect(channel).toEqual(expect.objectContaining({
      type: "contact_channel",
      channelType: "whatsapp",
      contactId: "contact-1",
    }));
    expect(conversation).toEqual(expect.objectContaining({
      type: "conversation",
      monitoringStatus: "pending_review",
      status: "active",
    }));
    expect(message).toEqual(expect.objectContaining({
      type: "message",
      direction: "inbound",
      relevanceType: "commercial",
    }));
  });

  it("creates opportunity, contract, crm event, task and interest records with shared boundaries", () => {
    const opportunity = createOpportunityRecord({
      title: "Cotacao inversor ABB",
    }, ownershipContext);
    const contract = createContractRecord({
      opportunityId: "opp-1",
    }, ownershipContext);
    const crmEvent = createCrmEventRecord({
      eventType: "quote_requested",
      sourceMessageIds: ["msg-1"],
    }, ownershipContext);
    const task = createTaskRecord({
      title: "Retornar cliente",
    }, ownershipContext);
    const interest = createInterestRecord({
      catalogItemId: "catalog-1",
      sourceMessageIds: ["msg-1"],
    }, ownershipContext);

    expect(opportunity).toEqual(expect.objectContaining({
      type: "opportunity",
      ownerId: "user-123",
      accountId: "acct_user-123",
      stage: "new",
      status: "open",
    }));
    expect(contract).toEqual(expect.objectContaining({
      type: "contract",
      ownerId: "user-123",
      accountId: "acct_user-123",
      opportunityId: "opp-1",
    }));
    expect(crmEvent).toEqual(expect.objectContaining({
      type: "crm_event",
      eventType: "quote_requested",
      sourceMessageIds: ["msg-1"],
    }));
    expect(task).toEqual(expect.objectContaining({
      type: "task",
      assignedToUserId: "user-123",
      status: "pending",
    }));
    expect(interest).toEqual(expect.objectContaining({
      type: "interest",
      catalogItemId: "catalog-1",
      sourceMessageIds: ["msg-1"],
    }));
  });
});

