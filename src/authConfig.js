import { LogLevel } from "@azure/msal-browser";

/**
 * DEBUG: Validate environment variables at runtime
 */
console.log("--- MSAL Config Initialization ---");
console.log("VITE_CLIENT_ID:", import.meta.env.VITE_CLIENT_ID ? "Found" : "MISSING (Check Vercel Env Vars)");
console.log("VITE_TENANT_ID:", import.meta.env.VITE_TENANT_ID || "common");
console.log("VITE_REDIRECT_URI:", import.meta.env.VITE_REDIRECT_URI || "Using window.location.origin");

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
if (!CLIENT_ID || CLIENT_ID === "undefined") {
    console.error("CRITICAL ERROR: VITE_CLIENT_ID is undefined. Microsoft login WILL fail.");
}

/**
 * Configuration object to be passed to MSAL instance on creation. 
 */
export const msalConfig = {
    auth: {
        clientId: CLIENT_ID, 
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || 'common'}`,
        // Fix: Ensure redirect URI matches exactly what is in Azure Portal
        // Common issue: https://site.com vs https://site.com/
        redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
        postLogoutRedirectUri: "/",
        navigateToLoginRequestUrl: true,
    },
    cache: {
        cacheLocation: "localStorage", // This ensures persistence across tabs and reloads
        storeAuthStateInCookie: true, // Required for Safari and cross-site issues
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                switch (level) {
                    case LogLevel.Error:
                        console.error("[MSAL Error]:", message);
                        return;
                    case LogLevel.Info:
                        console.info("[MSAL Info]:", message);
                        return;
                    case LogLevel.Verbose:
                        console.debug("[MSAL Verbose]:", message);
                        return;
                    case LogLevel.Warning:
                        console.warn("[MSAL Warning]:", message);
                        return;
                    default:
                        return;
                }
            }
        }
    }
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 */
export const loginRequest = {
    scopes: ["User.Read", "offline_access"]
};
