import { useState, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

function App() {
  const [deviceFlow, setDeviceFlow] = useState({
    status: "idle",
    flowId: null,
    userCode: null,
    verificationUri: null,
    message: null,
    account: null,
    error: null,
  });

  const [prtInfo, setPrtInfo] = useState(null);
  const [prtStatus, setPrtStatus] = useState({
    status: "idle",
    account: null,
    error: null,
  });

  const pollingInterval = useRef(null);

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

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
        error: error.message,
      });
    }
  };

  const startPolling = (flowId) => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/auth/device-code/status/${flowId}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status === "success") {
          setDeviceFlow((prev) => ({
            ...prev,
            status: "success",
            account: data.account,
          }));
          clearInterval(pollingInterval.current);
        } else if (data.status === "failed") {
          setDeviceFlow((prev) => ({
            ...prev,
            status: "failed",
            error: data.error,
          }));
          clearInterval(pollingInterval.current);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const resetDeviceFlow = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
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

  const loadPRTInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/prt/info`);
      const data = await response.json();
      setPrtInfo(data);
    } catch (error) {
      console.error("Failed to load PRT info:", error);
    }
  };

  const simulatePRTAuth = async () => {
    try {
      setPrtStatus({ status: "loading", account: null, error: null });

      const response = await fetch(`${API_URL}/auth/prt/silent-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
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
    } catch (error) {
      setPrtStatus({
        status: "failed",
        account: null,
        error: error.message,
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
      alert("All accounts logged out");
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
  };

  useEffect(() => {
    loadPRTInfo();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Azure Entra ID Authentication Demo</h1>
        <p>Demonstrating Device Code Flow and Primary Refresh Token (PRT) Concepts</p>
      </div>

      <div className="flows-container">
        <div className="flow-card">
          <h2>Device Code Flow</h2>
          <p>Authenticate on devices without a browser or keyboard. User completes authentication on a secondary device using a code.</p>

          {deviceFlow.status === "idle" && (
            <div>
              <button className="button" onClick={startDeviceCodeFlow}>
                Start Device Code Flow
              </button>
              <div className="flow-steps">
                <h4>How it works:</h4>
                <ol>
                  <li>Click Start Device Code Flow</li>
                  <li>You will receive a unique code</li>
                  <li>Open the verification URL in a browser</li>
                  <li>Enter the code and sign in with your Microsoft account</li>
                  <li>This app will automatically detect completion</li>
                </ol>
              </div>
            </div>
          )}

          {deviceFlow.status === "initiated" && (
            <div className="status-box pending">
              <div className="loading">Initiating device code flow</div>
            </div>
          )}

          {deviceFlow.status === "pending" && (
            <div>
              <div className="device-code-display">
                <p>
                  <strong>Go to: </strong>
                  <a href={deviceFlow.verificationUri} target="_blank" rel="noopener noreferrer">
                    {deviceFlow.verificationUri}
                  </a>
                </p>
                <p><strong>Enter this code:</strong></p>
                <div className="code">{deviceFlow.userCode}</div>
                <p style={{ fontSize: "0.9em", color: "#666" }}>Waiting for you to authenticate...</p>
              </div>

              <div className="status-box pending">
                <div className="loading">Polling for authentication</div>
                <p style={{ marginTop: "10px", fontSize: "0.9em" }}>
                  Complete the authentication in your browser. This page will update automatically.
                </p>
              </div>

              <button className="button secondary" onClick={resetDeviceFlow}>
                Cancel
              </button>
            </div>
          )}

          {deviceFlow.status === "success" && (
            <div>
              <div className="status-box success">
                <h3>Authentication Successful!</h3>
                <div className="account-info">
                  <h3>Authenticated Account:</h3>
                  <ul className="info-list">
                    <li><strong>Name:</strong> {deviceFlow.account.name}</li>
                    <li><strong>Email:</strong> {deviceFlow.account.username}</li>
                  </ul>
                </div>
              </div>
              <button className="button" onClick={resetDeviceFlow}>
                Try Again
              </button>
            </div>
          )}

          {deviceFlow.status === "failed" && (
            <div>
              <div className="status-box error">
                <h3>Authentication Failed</h3>
                <p>{deviceFlow.error}</p>
              </div>
              <button className="button" onClick={resetDeviceFlow}>
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="flow-card">
          <h2>Primary Refresh Token (PRT)</h2>
          <p>Special token for Windows 10/11 devices enabling seamless SSO across Azure AD-integrated apps without repeated authentication.</p>

          {prtInfo && (
            <div className="prt-info-section">
              <h4>About PRT:</h4>
              <p>{prtInfo.description}</p>

              <h4 style={{ marginTop: "15px" }}>Requirements:</h4>
              <ul>
                {prtInfo.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>

              <div style={{ background: "#fff3cd", padding: "10px", borderRadius: "4px", marginTop: "15px", border: "1px solid #ffc107" }}>
                <strong>Note:</strong> {prtInfo.note}
              </div>

              <h4 style={{ marginTop: "15px" }}>Reference Flow:</h4>
              <ol>
                <li>{prtInfo.referenceFlow.step1}</li>
                <li>{prtInfo.referenceFlow.step2}</li>
                <li>{prtInfo.referenceFlow.step3}</li>
                <li>{prtInfo.referenceFlow.step4}</li>
              </ol>
            </div>
          )}

          <div style={{ marginTop: "20px" }}>
            <button className="button" onClick={simulatePRTAuth} disabled={prtStatus.status === "loading"}>
              {prtStatus.status === "loading" ? "Simulating..." : "Simulate PRT Silent Auth"}
            </button>

            {prtStatus.status === "success" && (
              <div className="status-box success">
                <h3>Silent Authentication Successful</h3>
                <p style={{ fontSize: "0.9em", marginBottom: "10px" }}>{prtStatus.message}</p>
                <div className="account-info">
                  <h3>Account:</h3>
                  <ul className="info-list">
                    <li><strong>Name:</strong> {prtStatus.account.name}</li>
                    <li><strong>Email:</strong> {prtStatus.account.username}</li>
                  </ul>
                </div>
                <button className="button secondary" style={{ marginTop: "10px" }} onClick={resetPRTStatus}>
                  Reset
                </button>
              </div>
            )}

            {prtStatus.status === "failed" && (
              <div className="status-box error">
                <h3>Silent Authentication Failed</h3>
                <p>{prtStatus.error}</p>
                <p style={{ fontSize: "0.9em", marginTop: "10px" }}>
                  You need to authenticate first using Device Code Flow to cache credentials.
                </p>
                <button className="button secondary" style={{ marginTop: "10px" }} onClick={resetPRTStatus}>
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flow-card">
        <h2>Utilities</h2>
        <button className="button secondary" onClick={logoutAll}>
          Clear All Cached Tokens
        </button>
      </div>

      <div className="footer">
        <p>Built with React + Vite | Backend: Node.js + @azure/msal-node</p>
        <p>Azure Entra ID Authentication Demo for Freelance Project</p>
      </div>
    </div>
  );
}

export default App;