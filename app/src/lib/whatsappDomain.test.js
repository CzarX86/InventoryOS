import {
  HISTORY_BACKFILL_JOB_STATUSES,
  WHATSAPP_COLLECTIONS,
  WHATSAPP_EVENT_STATUSES,
  buildBackfillBucketKey,
  buildHistoryCutoffIso,
  buildWebhookEventDedupKey,
  createHistoryBackfillJobRecord,
  createMessageDispatchJobRecord,
  createTxtImportJobRecord,
  createWhatsappInstanceRecord,
  createWhatsappWebhookEventRecord,
  getNextBackfillQueueContact,
  markBackfillContactAttempt,
  markBackfillContactCompleted,
  markBackfillContactFailed,
} from "./whatsappDomain";

const ownershipContext = {
  ownerId: "user-123",
  defaultAccountId: "acct_user-123",
};

describe("whatsappDomain helpers", () => {
  it("creates a whatsapp instance and idempotent webhook event record", () => {
    const instance = createWhatsappInstanceRecord({
      instanceKey: "evolution-prod-01",
      phoneNumber: "+5511999999999",
      displayName: "Comercial XPTO",
    }, ownershipContext);
    const event = createWhatsappWebhookEventRecord({
      provider: "evolution",
      instanceId: "instance-1",
      eventType: "MESSAGES_UPSERT",
      externalEventId: "evt-123",
      payload: { key: { remoteJid: "5511999999999@s.whatsapp.net" } },
    }, ownershipContext);

    expect(WHATSAPP_COLLECTIONS.whatsappInstances).toBe("whatsapp_instances");
    expect(WHATSAPP_EVENT_STATUSES).toContain("processed");
    expect(instance).toEqual(expect.objectContaining({
      type: "whatsapp_instance",
      ownerId: "user-123",
      accountId: "acct_user-123",
      instanceKey: "evolution-prod-01",
      provider: "evolution",
      status: "active",
    }));
    expect(event).toEqual(expect.objectContaining({
      type: "whatsapp_webhook_event",
      dedupKey: "evolution:instance-1:MESSAGES_UPSERT:evt-123",
      status: "pending",
      provider: "evolution",
    }));
    expect(buildWebhookEventDedupKey({
      provider: "evolution",
      instanceId: "instance-1",
      eventType: "MESSAGES_UPSERT",
      externalEventId: "evt-123",
    })).toBe("evolution:instance-1:MESSAGES_UPSERT:evt-123");
  });

  it("creates a backfill job by date bucket and processes full relationship queue checkpoints", () => {
    const job = createHistoryBackfillJobRecord({
      targetDate: "2026-03-22",
      queueContacts: [
        { contactId: "contact-1", conversationId: "conv-1" },
        { contactId: "contact-2", conversationId: "conv-2" },
      ],
    }, ownershipContext);

    expect(HISTORY_BACKFILL_JOB_STATUSES).toContain("completed");
    expect(buildBackfillBucketKey("2026-03-22T18:30:00-03:00")).toBe("2026-03-22");
    expect(buildHistoryCutoffIso("2026-03-22")).toBe("2026-03-22T23:59:59.999Z");
    expect(job).toEqual(expect.objectContaining({
      type: "history_backfill_job",
      ownerId: "user-123",
      accountId: "acct_user-123",
      targetDate: "2026-03-22",
      dateBucketKey: "2026-03-22",
      processingMode: "full_relationship_until_bucket_date",
      status: "pending",
      checkpoint: expect.objectContaining({
        completedCount: 0,
        failedCount: 0,
        cursorContactId: "contact-1",
      }),
    }));
    expect(getNextBackfillQueueContact(job)).toEqual(expect.objectContaining({
      contactId: "contact-1",
      status: "pending",
    }));

    const runningJob = markBackfillContactAttempt(job, "contact-1", {
      startedAt: "2026-03-23T01:00:00.000Z",
    });
    expect(runningJob.status).toBe("running");
    expect(runningJob.checkpoint.cursorContactId).toBe("contact-1");

    const completedJob = markBackfillContactCompleted(runningJob, "contact-1", {
      completedAt: "2026-03-23T01:10:00.000Z",
      digestId: "digest-1",
    });
    expect(completedJob.queueContacts[0]).toEqual(expect.objectContaining({
      status: "completed",
      digestId: "digest-1",
    }));
    expect(completedJob.checkpoint.completedCount).toBe(1);
    expect(getNextBackfillQueueContact(completedJob)).toEqual(expect.objectContaining({
      contactId: "contact-2",
    }));

    const failedJob = markBackfillContactFailed(completedJob, "contact-2", {
      failedAt: "2026-03-23T01:20:00.000Z",
      errorCode: "RATE_LIMIT",
      errorMessage: "Too many requests",
    });
    expect(failedJob.queueContacts[1]).toEqual(expect.objectContaining({
      status: "failed",
      errorCode: "RATE_LIMIT",
    }));
    expect(failedJob.checkpoint.failedCount).toBe(1);
    expect(failedJob.status).toBe("completed");
    expect(getNextBackfillQueueContact(failedJob)).toBeNull();
  });

  it("creates txt import and message dispatch jobs with expansion boundaries", () => {
    const txtImport = createTxtImportJobRecord({
      contactId: "contact-1",
      conversationId: "conv-1",
      fileName: "chat.txt",
      storagePath: "imports/chat.txt",
    }, ownershipContext);
    const dispatch = createMessageDispatchJobRecord({
      conversationId: "conv-1",
      contactId: "contact-1",
      provider: "whatsapp",
      messageTemplateType: "reactivation_follow_up",
    }, ownershipContext);

    expect(txtImport).toEqual(expect.objectContaining({
      type: "txt_import_job",
      status: "pending",
      fileName: "chat.txt",
      storagePath: "imports/chat.txt",
    }));
    expect(dispatch).toEqual(expect.objectContaining({
      type: "message_dispatch_job",
      status: "pending_approval",
      channelType: "whatsapp",
      provider: "whatsapp",
    }));
  });
});
