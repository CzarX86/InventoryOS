const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Admin SDK for Emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
admin.initializeApp({
  projectId: "inventoryos-effd5"
});

const db = getFirestore();

async function runTest() {
  const messageId = "TEST_MSG_" + Date.now();
  console.log(`Creating test message: ${messageId}`);

  const messageDoc = {
    providerMessageId: messageId,
    remoteJid: "5511999999999@s.whatsapp.net",
    pushName: "Tester",
    text: "Vendi 3 teclados mecânicos por 450 reais cada",
    fromMe: false,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    type: "text",
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("whatsapp_messages").doc(messageId).set(messageDoc);
  console.log("Message created. Waiting for AI extraction trigger...");

  // Poll for extraction result
  let attempts = 0;
  const maxAttempts = 20;
  
  const poll = setInterval(async () => {
    attempts++;
    console.log(`Polling attempt ${attempts}...`);
    
    const extractionSnap = await db.collection("whatsapp_extracted_transactions")
      .where("messageId", "==", messageId)
      .limit(1)
      .get();

    if (!extractionSnap.empty) {
      clearInterval(poll);
      const data = extractionSnap.docs[0].data();
      console.log("\n✅ Extraction Success!");
      console.log("Result:", JSON.stringify(data, null, 2));
      process.exit(0);
    }

    if (attempts >= maxAttempts) {
      clearInterval(poll);
      console.log("\n❌ Timeout: Extraction not found.");
      
      // Check message for error
      const msgSnap = await db.collection("whatsapp_messages").doc(messageId).get();
      console.log("Message state:", msgSnap.data());
      
      process.exit(1);
    }
  }, 2000);
}

runTest().catch(err => {
  console.error("Test failed", err);
  process.exit(1);
});
