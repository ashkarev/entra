import React from "react";
import ReactDOM from "react-dom/client";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import App from "./App.jsx";
import "./index.css";

/**
 * 1. Initialize MSAL outside the component tree
 */
const msalInstance = new PublicClientApplication(msalConfig);

/**
 * 2. PRODUCTION AUTH BOOTSTRAP
 * This function ensures that MSAL is fully ready and state is restored 
 * BEFORE we render any React components.
 */
async function initializeAuth() {
    // Required for MSAL v3+
    await msalInstance.initialize();

    // 3. Handle the redirect promise (this is the core fix for redirect state loss)
    try {
        const response = await msalInstance.handleRedirectPromise();
        
        if (response?.account) {
            // Set the active account from the redirect result
            msalInstance.setActiveAccount(response.account);
            console.log("Auth restored from redirect:", response.account.username);
        } else {
            // No redirect response, check if we have accounts cached from a previous session
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                msalInstance.setActiveAccount(accounts[0]);
                console.log("Auth restored from cache:", accounts[0].username);
            }
        }
    } catch (error) {
        console.error("Redirect handling failed:", error);
    }

    // 4. Set up an event callback to catch any subsequent logins (like popups)
    msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
            msalInstance.setActiveAccount(event.payload.account);
        }
    });

    // 5. Finally, render the React app
    ReactDOM.createRoot(document.getElementById("root")).render(
        <React.StrictMode>
            <MsalProvider instance={msalInstance}>
                <App />
            </MsalProvider>
        </React.StrictMode>
    );
}

// Kick off the initialization
initializeAuth();