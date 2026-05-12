import { useState, useEffect, useRef } from "react";
import { useMsal, useIsAuthenticated, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
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
    if (loginType === "popup") {
      instance.loginPopup(loginRequest).catch(e => console.error(e));
    } else {
      instance.loginRedirect(loginRequest).catch(e => console.error(e));
    }
  };

  const handleLogout = () => {
    instance.logoutRedirect({
        postLogoutRedirectUri: "/",
    });
  };

  const getSilentToken = async () => {
    try {
      setPrtStatus({ status: "loading", account: null, error: null, message: null });
      
      const account = instance.getActiveAccount();
      if (!account) throw new Error("No active account found.");

      const request = {
        ...loginRequest,
        account: account
      };

      const response = await instance.acquireTokenSilent(request);
      
      setPrtStatus({
        status: "success",
        account: response.account,
        message: "Token acquired silently! Session is persistent.",
        error: null,
      });
    } catch (error) {
      console.error(error);
      setPrtStatus({
        status: "failed",
        account: null,
        error: error.message,
      });
    }
  };

  // =====================================
  // DEVICE CODE FLOW
  // =====================================

  const startDeviceCodeFlow = async () => {
    try {
      setDeviceFlow({ ...deviceFlow, status: "initiated", error: null });
      const response = await fetch(`${API_URL}/auth/device-code/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
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
      setDeviceFlow({ ...deviceFlow, status: "failed", error: error.message });
    }
  };

  const startPolling = (flowId) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/auth/device-code/status/${flowId}`);
        const data = await response.json();
        if (data.status === "success") {
          setDeviceFlow(prev => ({ ...prev, status: "success", account: data.account }));
          clearInterval(pollingInterval.current);
        } else if (data.status === "failed") {
          setDeviceFlow(prev => ({ ...prev, status: "failed", error: data.error }));
          clearInterval(pollingInterval.current);
        }
      } catch (error) {
        console.error(error);
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
        <p>Completing authentication... Please wait.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Azure Entra ID Full Auth Fix</h1>
        <p>Verified Production Architecture | Redirects & Persistence Fixed</p>
      </div>

      <div className="flows-container">
        {/* SECTION 1: STANDARD WEB AUTH */}
        <div className="flow-card">
          <h2>Standard Web Auth</h2>
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
            {activeAccount ? (
              <div className="status-box success">
                <h3>Welcome, {activeAccount.name}!</h3>
                <div className="account-info">
                  <ul className="info-list">
                    <li><strong>Email:</strong> {activeAccount.username}</li>
                    <li><strong>ID:</strong> {activeAccount.localAccountId}</li>
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
              <div className="code">{deviceFlow.userCode}</div>
              <div className="loading">Waiting for browser...</div>
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
        </div>

        {/* SECTION 3: SILENT AUTH */}
        <div className="flow-card">
          <h2>Silent Token Refresh</h2>
          <p>Acquire tokens without user interaction using local cache.</p>
          
          <button 
            className="button" 
            onClick={getSilentToken} 
            disabled={!isAuthenticated || !activeAccount}
          >
            Run Silent Auth
          </button>

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
      </div>
    </div>
  );
}

export default App;