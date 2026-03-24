"use client";
import { useState, useEffect } from "react";
import { demo_ExtractionFlow } from "@/lib/demoAiPlanner";
import { auth, db } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function AiTestPage() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("idle");
  const [user, setUser] = useState(null);
  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) addLog(`Authenticated as: ${u.uid}`);
    });
  }, []);

  const loginAsDemo = async () => {
    setStatus("logging_in");
    try {
      // Just set local state for E2E
      const mockUser = { uid: "demo-user", email: "demo@example.com" };
      
      // Initialize user doc if needed for defaultAccountId
      await setDoc(doc(db, "users", mockUser.uid), {
        uid: mockUser.uid,
        defaultAccountId: "demo-account",
        role: "admin"
      }, { merge: true });
      
      setUser(mockUser);
      addLog("Mock login successful (Bypassed Auth).");
      setStatus("idle");
    } catch (e) {
      addLog(`Login Failed: ${e.message}`);
      setStatus("error");
    }
  };

  const runDemo = async () => {
    setStatus("running");
    addLog("Starting AI Extraction Demo...");
    try {
      // Overriding console.log/error for the demo to capture in state
      const originalLog = console.log;
      const originalError = console.error;
      console.log = (...args) => {
        addLog(args.join(" "));
        originalLog(...args);
      };
      console.error = (...args) => {
        addLog(`ERROR: ${args.join(" ")}`);
        originalError(...args);
      };
 
      const flowResult = await demo_ExtractionFlow();
      setStatus("success");
      
      const res = flowResult.result;
      if (res?.status === "failed") {
        addLog(`Execution FAILED: ${res.errorMessage}`);
      }
      
      addLog(`Demo Finished: ${res?.status || 'unknown'}`);
      
      console.log = originalLog;
      console.error = originalError;
    } catch (e) {
      addLog(`CATCH ERROR: ${e.message}`);
      setStatus("error");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto dark">
      <h1 className="text-3xl font-bold mb-4">AI Infrastructure Test Bench</h1>
      
      <div className="flex gap-4 mb-8">
        {!user ? (
          <button 
            id="login-btn"
            onClick={loginAsDemo}
            disabled={status === "logging_in"}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
          >
            {status === "logging_in" ? "Logging in..." : "Login as Demo User"}
          </button>
        ) : (
          <button 
            id="run-demo-btn"
            onClick={runDemo}
            disabled={status === "running"}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {status === "running" ? "Running..." : "Run Extraction Demo"}
          </button>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm h-96 overflow-y-auto">
        <h2 className="text-zinc-400 mb-2 border-b border-zinc-800 pb-2">Execution Logs</h2>
        {logs.length === 0 && <p className="text-zinc-600 italic">No logs yet. Click run demo to start.</p>}
        {logs.map((log, i) => (
          <div key={i} className="mb-1 text-zinc-300 whitespace-pre-wrap">{log}</div>
        ))}
        {status === "success" && <div id="test-finished" className="mt-4 p-2 bg-green-900/30 text-green-400 border border-green-800 rounded">✅ Test Completed Successfully</div>}
      </div>
    </div>
  );
}
