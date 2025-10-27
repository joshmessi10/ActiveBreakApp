// auth-guard.js - Session validation and route protection
// This script must be loaded BEFORE any other scripts on protected pages

/**
 * Validates admin session and redirects to login if invalid
 * Checks for ab_current_user in localStorage with role='admin'
 */
function checkAdminSession() {
  try {
    const sessionData = localStorage.getItem("ab_current_user");

    if (!sessionData) {
      console.warn("No admin session found. Redirecting to login...");
      window.location.href = "/public/admin/admin-login.html";
      return;
    }

    const session = JSON.parse(sessionData);

    if (session.role !== "admin") {
      console.warn("Invalid role for admin area. Redirecting to login...");
      window.location.href = "/public/admin/admin-login.html";
      return;
    }

    // Session is valid
    console.log("✅ Admin session validated:", session.email);
  } catch (error) {
    console.error("Session validation error:", error);
    window.location.href = "/public/admin/admin-login.html";
  }
}

/**
 * Validates client session and redirects to login if invalid
 * Checks for ab_current_client in localStorage with role='client'
 */
function checkClientSession() {
  try {
    const sessionData = localStorage.getItem("ab_current_client");

    if (!sessionData) {
      console.warn("No client session found. Redirecting to login...");
      window.location.href = "/public/client/client-login.html";
      return;
    }

    const session = JSON.parse(sessionData);

    if (session.role !== "client") {
      console.warn("Invalid role for client area. Redirecting to login...");
      window.location.href = "/public/client/client-login.html";
      return;
    }

    // Session is valid
    console.log("✅ Client session validated:", session.email);
  } catch (error) {
    console.error("Session validation error:", error);
    window.location.href = "/public/client/client-login.html";
  }
}

/**
 * Validates either admin or client session
 * Allows access to pages that both roles can use (like settings)
 */
function checkAnySession() {
  try {
    // Check for admin session first
    const adminSessionData = localStorage.getItem("ab_current_user");
    if (adminSessionData) {
      const adminSession = JSON.parse(adminSessionData);
      if (adminSession.role === "admin") {
        console.log(
          "✅ Admin session validated for shared page:",
          adminSession.email
        );
        return;
      }
    }

    // Check for client session
    const clientSessionData = localStorage.getItem("ab_current_client");
    if (clientSessionData) {
      const clientSession = JSON.parse(clientSessionData);
      if (clientSession.role === "client") {
        console.log(
          "✅ Client session validated for shared page:",
          clientSession.email
        );
        return;
      }
    }

    // No valid session found
    console.warn("No valid session found. Redirecting to landing page...");
    window.location.href = "/public/landing.html";
  } catch (error) {
    console.error("Session validation error:", error);
    window.location.href = "/public/landing.html";
  }
}
