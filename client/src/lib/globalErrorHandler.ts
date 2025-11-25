/**
 * Global error handler for uncaught errors and unhandled promise rejections
 * This catches errors that escape React's ErrorBoundary
 */

// Report error to backend
async function reportErrorToBackend(errorData: any) {
  try {
    await fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(errorData),
    });
  } catch (err) {
    console.error("Failed to report error to backend:", err);
  }
}

// Handle uncaught errors
export function setupGlobalErrorHandler() {
  // Catch unhandled errors
  window.addEventListener("error", (event) => {
    console.error("Uncaught error:", event.error);
    
    reportErrorToBackend({
      message: event.error?.message || event.message || "Unknown error",
      stack: event.error?.stack || "No stack trace available",
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      type: "uncaught_error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    // Prevent default error handling (optional - can show custom UI)
    // event.preventDefault();
  });

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    
    reportErrorToBackend({
      message: event.reason?.message || String(event.reason) || "Unhandled promise rejection",
      stack: event.reason?.stack || "No stack trace available",
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      type: "unhandled_rejection",
      promise: event.promise,
    });

    // Prevent default error handling (optional)
    // event.preventDefault();
  });

  console.log("Global error handlers initialized");
}
