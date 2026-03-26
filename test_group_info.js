require("dotenv").config({ path: "app/.env.local" });

async function testFindGroupInfos() {
  const apiUrl = process.env.EVOLUTION_API_URL || "https://evo.example.com";
  const apiKey = process.env.EVOLUTION_API_KEY || "YOUR_KEY";
  
  console.log("Testing with:", { apiUrl, keyLength: apiKey.length });
  
  // Try to find instance name
  let instancesResponse;
  try {
    const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { "apikey": apiKey }
    });
    instancesResponse = await res.json();
  } catch (err) {
    console.error("Failed to fetch instances", err.message);
    return;
  }
  
  if (!instancesResponse || !instancesResponse.length) {
    console.error("No instances found");
    return;
  }

  const instanceName = instancesResponse[0].instance?.instanceName || instancesResponse[0].name;
  console.log("Using instance:", instanceName);
  
  // Try to fetch all groups to get a valid group JID
  const groupsRes = await fetch(`${apiUrl}/group/findAll/${instanceName}`, {
    headers: { "apikey": apiKey }
  });
  
  const groups = await groupsRes.json();
  if (!groups || !groups.length || groups.error) {
    console.error("No groups found or error:", groups);
    return;
  }
  
  const targetGroup = groups[0];
  const groupJid = targetGroup.id;
  console.log("Testing findGroupInfos with group JID:", groupJid, "Name:", targetGroup.subject || targetGroup.name);
  
  const url = `${apiUrl}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`;
  console.log("Endpoint:", url);
  
  try {
    const infoRes = await fetch(url, {
      headers: { "apikey": apiKey }
    });
    const info = await infoRes.json();
    console.log("Result:");
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.error("Error calling findGroupInfos:", err.message);
  }
}

testFindGroupInfos();
