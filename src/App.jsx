import { useState, useEffect, useRef } from "react";
import { useMsal, useIsAuthenticated, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { InteractionStatus, InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

const API_URL = import.meta.env.VITE_API_URL || "https://backend-3-b1pp.onrender.com";

function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const activeAccount = instance.getActiveAccount();
  
  const [deviceFlow, setDeviceFlow] = useState({
    status: "idle",
    flowId: null,
    userCode: null,
    verificationUri: null,
    message: null,
    account: null,
    error: null,
  });

  const [prtStatus, setPrtStatus] = useState({
    status: "idle",
    account: null,
    error: null,
    message: null
  });

  const pollingInterval = useRef(null);

  // =====================================
  // LOGIN / LOGOUT HANDLERS
  // =====================================

  const handleLogin = (loginType = "redirect") => {
    console.log(`Initiating ${loginType} login...`);
    if (loginType === "popup") {
      instance.loginPopup(loginRequest)
        .then(response => {
          console.log("Popup Login Success:", response);
          instance.setActiveAccount(response.account);
        })
        .catch(e => {
          console.error("Popup Login Error:", e);
        });
    } else {
      instance.loginRedirect(loginRequest).catch(e => {
        console.error("Redirect Login Error:", e);
      });
    }
  };

  const handleLogout = () => {
    console.log("Initiating logout...");
    instance.logoutRedirect({
        postLogoutRedirectUri: "/",
    }).catch(e => console.error("Logout Error:", e));
  };

  const getSilentToken = async () => {
    try {
      console.log("Starting silent token acquisition...");
      setPrtStatus({ status: "loading", account: null, error: null, message: null });
      
      const account = instance.getActiveAccount() || accounts[0];
      if (!account) {
        throw new Error("No active account found. Please sign in first.");
      }

      const request = {
        ...loginRequest,
        account: account
      };

      // Try silent first
      const response = await instance.acquireTokenSilent(request);
      console.log("Silent Token Success:", response);
      
      setPrtStatus({
        status: "success",
        account: response.account,
        message: "Token acquired silently! Session is persistent.",
        error: null,
      });
    } catch (error) {
      console.warn("Silent token acquisition failed:", error);
      
      if (error instanceof InteractionRequiredAuthError) {
        console.log("Interaction required for token refresh.");
        setPrtStatus({
          status: "failed",
          account: null,
          error: "Session expired or interaction required. Please sign in again.",
        });
        // Optionally trigger login
        // instance.acquireTokenRedirect(request);
      } else {
        setPrtStatus({
          status: "failed",
          account: null,
          error: error.message,
        });
      }
    }
  };

  // =====================================
  // DEVICE CODE FLOW
  // =====================================

  const startDeviceCodeFlow = async () => {
    try {
      console.log("Starting Device Code Flow via Backend...");
      setDeviceFlow({ ...deviceFlow, status: "initiated", error: null });
      const response = await fetch(`${API_URL}/auth/device-code/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error(`Backend Error: ${response.statusText}`);
      
      const data = await response.json();
      console.log("Device Code Flow Started:", data);
      
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
      console.error("Device Code Flow Error:", error);
      setDeviceFlow({ ...deviceFlow, status: "failed", error: error.message });
    }
  };

  const startPolling = (flowId) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    console.log(`Polling status for flow: ${flowId}`);
    
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/auth/device-code/status/${flowId}`);
        const data = await response.json();
        
        if (data.status === "success") {
          console.log("Device Auth Success:", data.account);
          setDeviceFlow(prev => ({ ...prev, status: "success", account: data.account }));
          clearInterval(pollingInterval.current);
        } else if (data.status === "failed") {
          console.error("Device Auth Failed:", data.error);
          setDeviceFlow(prev => ({ ...prev, status: "failed", error: data.error }));
          clearInterval(pollingInterval.current);
        }
      } catch (error) {
        console.error("Polling Error:", error);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => { if (pollingInterval.current) clearInterval(pollingInterval.current); };
  }, []);

  // =====================================
  // RENDER LOADING STATE
  // =====================================

  if (inProgress !== InteractionStatus.None) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Interaction in progress ({inProgress})... Please wait.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Azure Entra ID Full Auth Fix</h1>
        <p>Verified Production Architecture | Redirects & Persistence Fixed</p>
        <div className="debug-badge">
          {import.meta.env.MODE === "development" ? "DEVELOPMENT" : "PRODUCTION"}
        </div>
      </div>

      <div className="flows-container">
        {/* SECTION 1: STANDARD WEB AUTH */}
        <div className="flow-card">
          <div className="card-header">
             <h2>Standard Web Auth</h2>
             <span className={`status-dot ${isAuthenticated ? 'online' : 'offline'}`}></span>
          </div>
          <p>Auth Code Flow + PKCE | Session survives reloads.</p>
          
          <UnauthenticatedTemplate>
            <div className="status-box info">
              <p>You are not signed in.</p>
              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button className="button" onClick={() => handleLogin("redirect")}>
                  Login (Redirect)
                </button>
                <button className="button secondary" onClick={() => handleLogin("popup")}>
                  Login (Popup)
                </button>
              </div>
            </div>
          </UnauthenticatedTemplate>

          <AuthenticatedTemplate>
            {activeAccount || accounts[0] ? (
              <div className="status-box success">
                <h3>Welcome, {(activeAccount || accounts[0]).name}!</h3>
                <div className="account-info">
                  <ul className="info-list">
                    <li><strong>Email:</strong> {(activeAccount || accounts[0]).username}</li>
                    <li><strong>Tenant:</strong> {(activeAccount || accounts[0]).tenantId}</li>
                  </ul>
                </div>
                <button className="button secondary" onClick={handleLogout}>Logout</button>
              </div>
            ) : (
              <div className="status-box warning">
                <p>Authenticating state found but account details are still loading...</p>
              </div>
            )}
          </AuthenticatedTemplate>
        </div>

        {/* SECTION 2: DEVICE CODE FLOW */}
        <div className="flow-card">
          <h2>Device Code Flow</h2>
          <p>Simulation for secondary device authentication.</p>

          {deviceFlow.status === "idle" && (
            <button className="button" onClick={startDeviceCodeFlow}>Start Device Code Flow</button>
          )}

          {deviceFlow.status === "pending" && (
            <div className="device-code-display">
              <p>Go to: <a href={deviceFlow.verificationUri} target="_blank" rel="noreferrer">{deviceFlow.verificationUri}</a></p>
              <div className="code-box">
                <span className="code">{deviceFlow.userCode}</span>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(deviceFlow.userCode)}>Copy</button>
              </div>
              <div className="loading">Waiting for authorization...</div>
              <button className="button secondary" onClick={() => setDeviceFlow({ ...deviceFlow, status: "idle" })}>Cancel</button>
            </div>
          )}

          {deviceFlow.status === "success" && (
            <div className="status-box success">
              <h3>Success!</h3>
              <p>User: {deviceFlow.account?.name}</p>
              <button className="button secondary" onClick={() => setDeviceFlow({ ...deviceFlow, status: "idle" })}>Reset</button>
            </div>
          )}

          {deviceFlow.status === "failed" && (
             <div className="status-box error">
                <p>Error: {deviceFlow.error}</p>
                <button className="button" onClick={() => setDeviceFlow({ ...deviceFlow, status: "idle" })}>Try Again</button>
             </div>
          )}
        </div>

        {/* SECTION 3: SILENT AUTH */}
        <div className="flow-card">
          <h2>Silent Token Refresh</h2>
          <p>Acquire tokens without user interaction using local cache.</p>
          
          <button 
            className="button" 
            onClick={getSilentToken} 
            disabled={!isAuthenticated}
          >
            Run Silent Auth
          </button>

          {prtStatus.status === "loading" && <div className="loading">Checking cache...</div>}

          {prtStatus.status === "success" && (
            <div className="status-box success" style={{ marginTop: "15px" }}>
              <h4>Token Refreshed</h4>
              <p style={{ fontSize: "0.85em" }}>{prtStatus.message}</p>
            </div>
          )}

          {prtStatus.status === "failed" && (
            <div className="status-box error" style={{ marginTop: "15px" }}>
              <h4>Failed</h4>
              <p>{prtStatus.error}</p>
            </div>
          )}
        </div>
      </div>

      <div className="footer">
        <p>Production Architecture | msal-browser + msal-react</p>
        <p className="small">Vite Configured | PKCE Enabled</p>
      </div>
    </div>
  );
}

export default App;