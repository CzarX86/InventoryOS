"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const whatsappDomain_1 = require("./whatsappDomain");
const ownershipContext = {
    ownerId: "user-123",
    defaultAccountId: "acct_user-123",
};
describe("functions whatsappDomain helpers", () => {
    it("creates instance and webhook event records with idempotency key", () => {
        const instance = (0, whatsappDomain_1.createWhatsappInstanceRecord)({
            instanceKey: "evolution-prod-01",
        }, ownershipContext);
        const event = (0, whatsappDomain_1.createWhatsappWebhookEventRecord)({
            instanceId: "instance-1",
            eventType: "MESSAGES_SET",
            externalEventId: "evt-1",
        }, ownershipContext);
        expect(whatsappDomain_1.WHATSAPP_COLLECTIONS.whatsappWebhookEvents).toBe("whatsapp_webhook_events");
        expect(instance.type).toBe("whatsapp_instance");
        expect(event.dedupKey).toBe("evolution:instance-1:MESSAGES_SET:evt-1");
        expect((0, whatsappDomain_1.buildWebhookEventDedupKey)({
            instanceId: "instance-1",
            eventType: "MESSAGES_SET",
            externalEventId: "evt-1",
        })).toBe("evolution:instance-1:MESSAGES_SET:evt-1");
    });
    it("tracks queue checkpoint progression for history backfill jobs", () => {
        const job = (0, whatsappDomain_1.createHistoryBackfillJobRecord)({
            targetDate: "2026-03-21",
            queueContacts: [{ contactId: "contact-1" }, { contactId: "contact-2" }],
        }, ownershipContext);
        const attempted = (0, whatsappDomain_1.markBackfillContactAttempt)(job, "contact-1", {
            startedAt: "2026-03-23T01:00:00.000Z",
        });
        const completed = (0, whatsappDomain_1.markBackfillContactCompleted)(attempted, "contact-1", {
            completedAt: "2026-03-23T01:05:00.000Z",
        });
        expect((0, whatsappDomain_1.buildBackfillBucketKey)("2026-03-21T09:15:00-03:00")).toBe("2026-03-21");
        expect(completed.checkpoint.completedCount).toBe(1);
        expect((0, whatsappDomain_1.getNextBackfillQueueContact)(completed).contactId).toBe("contact-2");
    });
    it("creates txt import and dispatch jobs", () => {
        const txtImport = (0, whatsappDomain_1.createTxtImportJobRecord)({
            fileName: "chat.txt",
            storagePath: "imports/chat.txt",
        }, ownershipContext);
        const dispatch = (0, whatsappDomain_1.createMessageDispatchJobRecord)({
            provider: "whatsapp",
        }, ownershipContext);
        expect(txtImport.type).toBe("txt_import_job");
        expect(dispatch.type).toBe("message_dispatch_job");
    });
});
//# sourceMappingURL=whatsappDomain.test.js.map