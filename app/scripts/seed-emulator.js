#!/usr/bin/env node
/**
 * Seed script for local Firebase emulator.
 * Run after starting emulators: node scripts/seed-emulator.js
 */

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

// Uses firebase-admin from the functions directory
const admin = require("../functions/node_modules/firebase-admin");
const getFirestore = () => admin.firestore();

admin.initializeApp({ projectId: "inventoryos-effd5" });
const db = getFirestore();

async function seed() {
  // --- Admin user ---
  // UID comes from real Google Auth (not emulated).
  // Update ADMIN_UID if your Google account UID changes.
  const ADMIN_UID = "pdG22XOEzOfYB2495cdQV0L9sE62";
  const ADMIN_EMAIL = "julio.cezar777@gmail.com";

  await db.collection("users").doc(ADMIN_UID).set({
    email: ADMIN_EMAIL,
    role: "admin",
    aiWorkflow: "real-time",
    sharePriceByDefault: false,
    createdAt: new Date().toISOString(),
  });

  console.log(`✓ Admin user seeded (${ADMIN_EMAIL})`);

  // --- System config ---
  await db.collection("system").doc("support").set({
    primaryAdminUid: ADMIN_UID,
  });

  console.log("✓ system/support seeded");
  console.log("\nEmulator ready. Start the app with: pnpm dev");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
