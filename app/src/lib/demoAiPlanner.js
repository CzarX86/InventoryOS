import { planAiTask, executeAiTask, writeAiResult } from "./aiTaskPlanner";

/**
 * This is a demonstration function that could be called from a dev console 
 * or a specific testing page.
 */
export async function demo_ExtractionFlow() {
  const ownershipContext = {
    ownerId: "demo-user",
    accountId: "demo-account",
  };

  console.log("1. Planning task: extract_contact...");
  const plan = await planAiTask("extract_contact", "msg_001", {
    targetType: "whatsapp_message",
    metadata: { originalText: "Talk to John at +5511999999999" },
    requiresApproval: false, // Auto-approve for demo
  }, ownershipContext);

  console.log("Plan created with ID:", plan.id);
  console.log("Estimated Model:", plan.model);
  console.log("Estimated Cost USD:", plan.estimatedCostUsd);

  // Mark as approved (simulating what would happen if requiresApproval was true)
  plan.status = "approved"; 

  console.log("\n2. Executing task...");
  const result = await executeAiTask(plan, `Extract contact from: ${plan.metadata.originalText}`);
  
  if (result.status === "completed") {
    console.log("Execution COMPLETED!");
    console.log("Output JSON:", result.output);
    console.log("Actual Total Tokens:", result.actualUsage.totalTokenCount);
    
    console.log("\n3. Writing result to domain...");
    const domainRecord = await writeAiResult(result, (data) => {
      // Simulation of writing to supplier_contacts
      return { id: "contact_001", ...data };
    });
    
    console.log("Domain Record with LINEAGE:", domainRecord);
    return { plan, result, domainRecord };
  } else {
    console.error("Execution FAILED:", result.errorMessage);
    return { plan, result };
  }
}
