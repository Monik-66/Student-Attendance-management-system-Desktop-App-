const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { createApiClient } = require("./api-client");

dotenv.config({ path: path.join(__dirname, ".env") });

const configuredApiBaseUrl = String(process.env.API_BASE_URL || "").trim();
const apiPort = Number(process.env.API_PORT || 4011);
const apiBaseUrl = configuredApiBaseUrl || `http://127.0.0.1:${apiPort}`;
const api = createApiClient(apiBaseUrl);
const appIconPath = path.join(__dirname, "app-icon.png");

let backendProcess = null;
let sessionToken = null;
let currentAdminSession = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f4efe4",
    title: "SNPSU Admin Desktop",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setIcon(appIconPath);
  mainWindow.loadFile("index.html");
}

async function waitForBackendReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  const expectedService = "admin";

  while (Date.now() < deadline) {
    try {
      const status = await api.getHealth();
      if (status.ok && status.service === expectedService) {
        return status;
      }
      if (status.ok) {
        const detectedService = status.service || "unknown";
        lastError = new Error(
          `Port ${apiPort} is responding with the ${detectedService} backend instead of the admin backend. Close the other SNPSU app and reopen the admin desktop.`
        );
      } else {
        lastError = new Error(status.message || "Backend health check failed.");
      }
    } catch (error) {
      lastError = error;
    }

    await delay(400);
  }

  throw lastError || new Error("Backend did not become ready in time.");
}

async function ensureBackendService() {
  if (configuredApiBaseUrl) {
    return waitForBackendReady(10000);
  }

  if (!backendProcess || backendProcess.killed) {
    backendProcess = fork(path.join(__dirname, "server.js"), {
      cwd: __dirname,
      stdio: "ignore"
    });

    backendProcess.on("exit", () => {
      backendProcess = null;
    });
  }

  return waitForBackendReady(15000);
}

function getSessionToken() {
  if (!sessionToken) {
    throw new Error("Please sign in again.");
  }

  return sessionToken;
}

async function exportHtmlToPdf({ html, defaultFileName }) {
  if (!html || typeof html !== "string") {
    throw new Error("No printable report content was provided.");
  }

  const savePathResult = await dialog.showSaveDialog({
    title: "Save admin attendance report",
    defaultPath: path.join(app.getPath("downloads"), defaultFileName || "admin_attendance_report.pdf"),
    filters: [{ name: "PDF files", extensions: ["pdf"] }]
  });

  if (savePathResult.canceled || !savePathResult.filePath) {
    return { ok: false, canceled: true, message: "Export cancelled." };
  }

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: {
        top: 0.35,
        bottom: 0.35,
        left: 0.3,
        right: 0.3
      }
    });

    await fs.promises.writeFile(savePathResult.filePath, pdfBuffer);
    return { ok: true, canceled: false, filePath: savePathResult.filePath };
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
}

ipcMain.handle("db:status", async () => {
  try {
    await ensureBackendService();
    const status = await api.getHealth();
    return { ...status, apiBaseUrl };
  } catch (error) {
    return { ok: false, configured: true, message: error.message, apiBaseUrl };
  }
});

ipcMain.handle("db:ensure-schema", async () => {
  try {
    await ensureBackendService();
    const result = await api.bootstrap();
    return { ...result, apiBaseUrl };
  } catch (error) {
    return { ok: false, configured: true, message: error.message, apiBaseUrl };
  }
});

ipcMain.handle("admin:login", async (_event, payload) => {
  try {
    await ensureBackendService();
    const result = await api.loginAdmin(payload);

    if (!result.ok || !result.admin || !result.token) {
      throw new Error(result.message || "Admin login failed.");
    }

    sessionToken = result.token;
    currentAdminSession = {
      adminId: result.admin.adminId,
      name: result.admin.name,
      role: result.admin.role || "admin"
    };

    return { ok: true, configured: true, admin: currentAdminSession };
  } catch (error) {
    return { ok: false, configured: true, message: error.message };
  }
});

ipcMain.handle("admin:logout", async () => {
  sessionToken = null;
  currentAdminSession = null;
  return { ok: true };
});

ipcMain.handle("admin:overview", async () => {
  try {
    await ensureBackendService();
    const result = await api.getAdminOverview(getSessionToken());
    return { ok: true, configured: true, sections: result.sections || [] };
  } catch (error) {
    return { ok: false, configured: true, sections: [], message: error.message };
  }
});

ipcMain.handle("admin:section-report", async (_event, payload) => {
  try {
    await ensureBackendService();
    const result = await api.getAdminSectionReport(payload, getSessionToken());
    return { ok: true, configured: true, report: result.report || null };
  } catch (error) {
    return { ok: false, configured: true, report: null, message: error.message };
  }
});

ipcMain.handle("admin:edit-dataset", async (_event, payload) => {
  try {
    await ensureBackendService();
    const result = await api.getAdminEditDataset(payload, getSessionToken());
    return { ok: true, configured: true, dataset: result.dataset || null };
  } catch (error) {
    return { ok: false, configured: true, dataset: null, message: error.message };
  }
});

ipcMain.handle("admin:edit-section-meta", async (_event, payload) => {
  try {
    await ensureBackendService();
    const result = await api.saveAdminSectionMeta(payload, getSessionToken());
    return { ok: true, configured: true, section: result.section || null };
  } catch (error) {
    return { ok: false, configured: true, message: error.message };
  }
});

ipcMain.handle("admin:edit-students", async (_event, payload) => {
  try {
    await ensureBackendService();
    const result = await api.saveAdminStudents(payload, getSessionToken());
    return { ok: true, configured: true, updatedCount: result.updatedCount || 0 };
  } catch (error) {
    return { ok: false, configured: true, updatedCount: 0, message: error.message };
  }
});

ipcMain.handle("admin:edit-assignments", async (_event, payload) => {
  try {
    await ensureBackendService();
    const result = await api.saveAdminAssignments(payload, getSessionToken());
    return { ok: true, configured: true, updatedCount: result.updatedCount || 0 };
  } catch (error) {
    return { ok: false, configured: true, updatedCount: 0, message: error.message };
  }
});

ipcMain.handle("admin:export-pdf", async (_event, payload) => {
  try {
    return await exportHtmlToPdf({
      html: payload?.html || "",
      defaultFileName: payload?.defaultFileName || "admin_attendance_report.pdf"
    });
  } catch (error) {
    return { ok: false, canceled: false, message: error.message };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  sessionToken = null;
  currentAdminSession = null;

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
