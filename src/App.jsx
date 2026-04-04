import { useState, useEffect, useRef } from "react";

// ✅ FIXED API URL (env-based)
const API_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://backend-3-qmna.onrender.com";

function App() {
  // Device Code Flow State
  const [deviceFlow, setDeviceFlow] = useState({
    status: "idle",
    flowId: null,
    userCode: null,
    verificationUri: null,
    message: null,
    account: null,
    error: null,
  });

  // PRT State
  const [prtInfo, setPrtInfo] = useState(null);
  const [prtStatus, setPrtStatus] = useState({
    status: "idle",
    account: null,
    error: null,
  });

  const pollingInterval = useRef(null);

  // ================= DEVICE CODE FLOW =================

  const startDeviceCodeFlow = async () => {
    try {
      setDeviceFlow({
        status: "initiated",
        flowId: null,
        userCode: null,
        verificationUri: null,
        message: null,
        account: null,
        error: null,
      });

      const response = await fetch(`${API_URL}/auth/device-code/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      setDeviceFlow({
        status: "pending",
        flowId: data.flowId,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        message: data.message,
        account: null,
        error: null,
      });

      startPolling(data.flowId);
    } catch (error) {
      setDeviceFlow({
        status: "failed",
        flowId: null,
        userCode: null,
        verificationUri: null,
        message: null,
        account: null,
        error: error.message || "Something went wrong",
      });
    }
  };

  const startPolling = (flowId) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    pollingInterval.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_URL}/auth/device-code/status/${flowId}`
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (data.status === "success") {
          setDeviceFlow((prev) => ({
            ...prev,
            status: "success",
            account: data.account,
          }));
          clearInterval(pollingInterval.current);
        }

        if (data.status === "failed") {
          setDeviceFlow((prev) => ({
            ...prev,
            status: "failed",
            error: data.error,
          }));
          clearInterval(pollingInterval.current);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  const resetDeviceFlow = () => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    setDeviceFlow({
      status: "idle",
      flowId: null,
      userCode: null,
      verificationUri: null,
      message: null,
      account: null,
      error: null,
    });
  };

  // ================= PRT =================

  const loadPRTInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/prt/info`);
      const data = await res.json();
      setPrtInfo(data);
    } catch (err) {
      console.error(err);
    }
  };

  const simulatePRTAuth = async () => {
    try {
      setPrtStatus({ status: "loading", account: null, error: null });

      const res = await fetch(`${API_URL}/auth/prt/silent-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (res.ok) {
        setPrtStatus({
          status: "success",
          account: data.account,
          message: data.message,
          error: null,
        });
      } else {
        setPrtStatus({
          status: "failed",
          account: null,
          error: data.message || data.error,
        });
      }
    } catch (err) {
      setPrtStatus({
        status: "failed",
        account: null,
        error: err.message,
      });
    }
  };

  const resetPRTStatus = () => {
    setPrtStatus({ status: "idle", account: null, error: null });
  };

  const logoutAll = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: "POST" });
      resetDeviceFlow();
      resetPRTStatus();
      alert("Logged out ✅");
    } catch (err) {
      alert("Logout failed");
    }
  };

  useEffect(() => {
    loadPRTInfo();
  }, []);

  // ================= UI =================

  return (
    <div className="container">
      <h1>Azure Entra ID Authentication</h1>

      <button onClick={startDeviceCodeFlow}>Start Login</button>

      {deviceFlow.status === "pending" && (
        <>
          <p>
            Go to{" "}
            <a
              href={deviceFlow.verificationUri}
              target="_blank"
              rel="noreferrer"
            >
              {deviceFlow.verificationUri}
            </a>
          </p>
          <h2>{deviceFlow.userCode}</h2>
        </>
      )}

      {deviceFlow.status === "success" && (
        <div>
          <h3>Success</h3>
          <p>{deviceFlow.account?.username}</p>
        </div>
      )}

      {deviceFlow.status === "failed" && (
        <div>
          <h3>Failed</h3>
          <p>{deviceFlow.error || "Try again"}</p>
          <button onClick={resetDeviceFlow}>Try Again</button>
        </div>
      )}

      <hr />

      <button onClick={simulatePRTAuth}>PRT Auth</button>

      {prtStatus.status === "success" && (
        <p>{prtStatus.account?.username}</p>
      )}

      {prtStatus.status === "failed" && (
        <p>{prtStatus.error}</p>
      )}

      <button onClick={logoutAll}>Logout</button>
    </div>
  );
}

export default App;