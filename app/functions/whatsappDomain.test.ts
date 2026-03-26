import {
  WHATSAPP_COLLECTIONS,
  buildBackfillBucketKey,
  buildWebhookEventDedupKey,
  createHistoryBackfillJobRecord,
  createMessageDispatchJobRecord,
  createTxtImportJobRecord,
  createWhatsappInstanceRecord,
  createWhatsappWebhookEventRecord,
  getNextBackfillQueueContact,
  markBackfillContactAttempt,
  markBackfillContactCompleted,
} from "./whatsappDomain";

const ownershipContext = {
  ownerId: "user-123",
  defaultAccountId: "acct_user-123",
};

describe("functions whatsappDomain helpers", () => {
  it("creates instance and webhook event records with idempotency key", () => {
    const instance = createWhatsappInstanceRecord({
      instanceKey: "evolution-prod-01",
    }, ownershipContext);
    const event = createWhatsappWebhookEventRecord({
      instanceId: "instance-1",
      eventType: "MESSAGES_SET",
      externalEventId: "evt-1",
    }, ownershipContext);

    expect(WHATSAPP_COLLECTIONS.whatsappWebhookEvents).toBe("whatsapp_webhook_events");
    expect(instance.type).toBe("whatsapp_instance");
    expect(event.dedupKey).toBe("evolution:instance-1:MESSAGES_SET:evt-1");
    expect(buildWebhookEventDedupKey({
      instanceId: "instance-1",
      eventType: "MESSAGES_SET",
      externalEventId: "evt-1",
    } as any)).toBe("evolution:instance-1:MESSAGES_SET:evt-1");
  });

  it("tracks queue checkpoint progression for history backfill jobs", () => {
    const job = createHistoryBackfillJobRecord({
      targetDate: "2026-03-21",
      queueContacts: [{ contactId: "contact-1" }, { contactId: "contact-2" }],
    }, ownershipContext);

    const attempted = markBackfillContactAttempt(job, "contact-1", {
      startedAt: "2026-03-23T01:00:00.000Z",
    });
    const completed = markBackfillContactCompleted(attempted, "contact-1", {
      completedAt: "2026-03-23T01:05:00.000Z",
    });

    expect(buildBackfillBucketKey("2026-03-21T09:15:00-03:00")).toBe("2026-03-21");
    expect(completed.checkpoint.completedCount).toBe(1);
    expect(getNextBackfillQueueContact(completed).contactId).toBe("contact-2");
  });

  it("creates txt import and dispatch jobs", () => {
    const txtImport = createTxtImportJobRecord({
      fileName: "chat.txt",
      storagePath: "imports/chat.txt",
    }, ownershipContext);
    const dispatch = createMessageDispatchJobRecord({
      provider: "whatsapp",
    }, ownershipContext);

    expect(txtImport.type).toBe("txt_import_job");
    expect(dispatch.type).toBe("message_dispatch_job");
  });
});
