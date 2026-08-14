const DEFAULT_TIMEOUT_MS = 10000;

async function requestJson(baseUrl, pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout_ms || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const looksLikeHtml = /^\s*</.test(text);
        const genericMessage = looksLikeHtml
          ? "The app received an HTML page instead of an API response. Make sure the correct backend service is running."
          : "The app received an invalid response from the backend service.";

        throw new Error(response.ok ? genericMessage : `${genericMessage} Status ${response.status}.`);
      }
    }

    if (!response.ok) {
      const message = data.message || `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function createApiClient(baseUrl) {
  return {
    getHealth: () => requestJson(baseUrl, "/health"),
    bootstrap: () => requestJson(baseUrl, "/api/system/bootstrap", { method: "POST" }),
    loginTeacher: (payload) => requestJson(baseUrl, "/api/auth/login", { method: "POST", body: payload }),
    loginAdmin: (payload) => requestJson(baseUrl, "/api/admin/login", { method: "POST", body: payload }),
    getAdminOverview: (token) => requestJson(baseUrl, "/api/admin/overview", { token }),
    getAdminSectionReport: (payload, token) =>
      requestJson(
        baseUrl,
        `/api/admin/section-report?sectionCode=${encodeURIComponent(payload.sectionCode)}`,
        { token }
      ),
    getSectionSummary: (payload, token) =>
      requestJson(baseUrl, "/api/attendance/summary", { method: "POST", body: payload, token }),
    getSectionAnalytics: (payload, token) =>
      requestJson(baseUrl, "/api/sections/analytics", { method: "POST", body: payload, token }),
    getAvailableDates: (payload, token) =>
      requestJson(
        baseUrl,
        `/api/attendance/dates?sectionCode=${encodeURIComponent(payload.sectionCode)}&subjectCode=${encodeURIComponent(payload.subjectCode || "")}`,
        { token }
      ),
    loadSectionAttendance: (payload, token) =>
      requestJson(
        baseUrl,
        `/api/attendance/section?sectionCode=${encodeURIComponent(payload.sectionCode)}&subjectCode=${encodeURIComponent(payload.subjectCode || "")}`,
        { token }
      ),
    saveAttendanceDate: (payload, token) =>
      requestJson(baseUrl, "/api/attendance/save", { method: "POST", body: payload, token }),
    resetAttendanceDate: (payload, token) =>
      requestJson(baseUrl, "/api/attendance/reset", { method: "POST", body: payload, token })
  };
}

module.exports = {
  createApiClient
};
