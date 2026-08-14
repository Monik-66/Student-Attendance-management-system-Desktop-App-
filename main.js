const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const dotenv = require("dotenv");
const { createApiClient } = require("./api-client");
const { createOfflineStore } = require("./offline-store");
const { sendAbsenteeSms } = require("./ozeki-service");

dotenv.config({ path: path.join(__dirname, ".env") });

const configuredApiBaseUrl = String(process.env.API_BASE_URL || "").trim();
const apiPort = Number(process.env.API_PORT || 4010);
const apiBaseUrl = configuredApiBaseUrl || `http://127.0.0.1:${apiPort}`;
const api = createApiClient(apiBaseUrl);

let backendProcess = null;
let sessionToken = null;
let currentTeacherSession = null;
let offlineStore = null;
const appIconPath = path.join(__dirname, "app-icon.png");

function getOfflineStore() {
  if (!offlineStore) {
    offlineStore = createOfflineStore(path.join(app.getPath("userData"), "offline-attendance.json"));
  }

  return offlineStore;
}

function logMainProcessError(prefix, error) {
  const message = error?.stack || error?.message || String(error);
  try {
    process.stderr.write(`${prefix}: ${message}\n`);
  } catch {}
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#f4efe4",
    title: "SNPSU Teacher Desktop",
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeTeacher(teacher) {
  return {
    teacherId: teacher.teacherId,
    name: teacher.name,
    subject: teacher.subject,
    subjectCode: teacher.courseShortCode || teacher.subjectCode || teacher.subject,
    courseName: teacher.courseName || teacher.subject,
    courseShortCode: teacher.courseShortCode || teacher.subjectCode || teacher.subject,
    subjectAssignments: Array.isArray(teacher.subjectAssignments) ? teacher.subjectAssignments : [],
    department: teacher.department,
    designation: teacher.designation,
    semester: teacher.semester,
    sections: (teacher.sections || [])
      .filter(Boolean)
      .map((section) => (typeof section === "string" ? section : section.code))
      .filter(Boolean)
  };
}

function getTeacherSectionSubjectPairs(teacher) {
  const subjectAssignments = Array.isArray(teacher?.subjectAssignments) ? teacher.subjectAssignments : [];
  const pairs = [];

  for (const assignment of subjectAssignments) {
    const subjectCode = assignment?.courseShortCode || assignment?.subjectCode || "";
    for (const sectionCode of assignment?.sections || []) {
      if (!subjectCode || !sectionCode) {
        continue;
      }

      pairs.push({ sectionCode, subjectCode });
    }
  }

  return pairs;
}

async function waitForBackendReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  const expectedService = "teacher";

  while (Date.now() < deadline) {
    try {
      const status = await api.getHealth();
      if (status.ok && status.service === expectedService) {
        return status;
      }
      if (status.ok) {
        const detectedService = status.service || "unknown";
        lastError = new Error(
          `Port ${apiPort} is responding with the ${detectedService} backend instead of the teacher backend. Close the other SNPSU app and reopen the teacher desktop.`
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
    throw new Error("Please sign in again once the internet connection is available.");
  }

  return sessionToken;
}

function getCurrentTeacherSession() {
  if (!currentTeacherSession) {
    throw new Error("Please sign in again.");
  }

  return currentTeacherSession;
}

async function refreshCachedSections(teacherId, teacher) {
  const token = getSessionToken();

  for (const pair of getTeacherSectionSubjectPairs(teacher)) {
    const [studentsResult, datesResult] = await Promise.all([
      api.loadSectionAttendance(pair, token),
      api.getAvailableDates(pair, token)
    ]);

    getOfflineStore().updateSection(teacherId, pair.sectionCode, pair.subjectCode, {
      students: studentsResult.students || [],
      availableDates: datesResult.dates || []
    });
  }
}

async function flushQueuedAttendance(teacherId) {
  const result = await getOfflineStore().syncQueuedAttendance({
    teacherId,
    token: getSessionToken(),
    apiClient: api
  });

  if (result.syncedCount > 0) {
    await refreshCachedSections(teacherId, currentTeacherSession);
  }

  return result;
}

async function loginOnline(payload) {
  await ensureBackendService();
  const result = await api.loginTeacher(payload);

  if (!result.ok || !result.teacher || !result.token) {
    throw new Error(result.message || "Login failed.");
  }

  sessionToken = result.token;
  currentTeacherSession = serializeTeacher(result.teacher);
  getOfflineStore().cacheTeacher(result.teacher, { preserveSectionData: false });
  await refreshCachedSections(currentTeacherSession.teacherId, currentTeacherSession);

  const flushResult = await flushQueuedAttendance(currentTeacherSession.teacherId);
  return {
    teacher: serializeTeacher(result.teacher),
    syncedCount: flushResult.syncedCount
  };
}

function loadOfflineTeacher(payload) {
  const cachedTeacher = getOfflineStore().getCachedTeacher(payload.teacherName, payload.teacherId);
  if (!cachedTeacher) {
    return null;
  }

  sessionToken = null;
  currentTeacherSession = serializeTeacher(cachedTeacher);
  return {
    teacher: serializeTeacher(cachedTeacher),
    queuedCount: getOfflineStore().getQueuedCount(cachedTeacher.teacherId)
  };
}

ipcMain.handle("db:status", async () => {
  try {
    await ensureBackendService();
    const status = await api.getHealth();
    return { ...status, apiBaseUrl, offlineCapable: true };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error.message,
      apiBaseUrl,
      offlineCapable: true
    };
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

ipcMain.handle("teacher:login", async (_event, payload) => {
  try {
    const result = await loginOnline(payload);
    return {
      ok: true,
      configured: true,
      teacher: result.teacher,
      syncedCount: result.syncedCount,
      offline: false
    };
  } catch (error) {
    const offlineResult = loadOfflineTeacher(payload);
    if (!offlineResult) {
      return { ok: false, configured: true, message: error.message };
    }

    return {
      ok: true,
      configured: true,
      teacher: offlineResult.teacher,
      offline: true,
      queuedCount: offlineResult.queuedCount,
      message: `Offline mode active. Using cached data for ${offlineResult.teacher.name}.`
    };
  }
});

ipcMain.handle("teacher:logout", async () => {
  sessionToken = null;
  currentTeacherSession = null;
  return { ok: true };
});

ipcMain.handle("teacher:sync-offline", async (_event, payload) => {
  try {
    const result = await loginOnline(payload);
    await refreshCachedSections(result.teacher.teacherId, serializeTeacher(result.teacher));

    return {
      ok: true,
      configured: true,
      syncedCount: result.syncedCount,
      queuedCount: getOfflineStore().getQueuedCount(result.teacher.teacherId),
      teacher: result.teacher,
      online: true
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error.message,
      online: false
    };
  }
});

ipcMain.handle("attendance:section-summary", async (_event, payload) => {
  const teacher = getCurrentTeacherSession();

  try {
    await ensureBackendService();
    const result = await api.getSectionSummary(payload, getSessionToken());
    return { ok: true, configured: true, sections: result.sections || [], offline: false };
  } catch (error) {
    return {
      ok: true,
      configured: true,
      sections: getOfflineStore().buildSectionSummary(teacher.teacherId, payload.sectionCodes || [], payload.subjectCode, payload.selectedIsoDate),
      offline: true,
      message: error.message
    };
  }
});

ipcMain.handle("sections:analytics", async (_event, payload) => {
  const teacher = getCurrentTeacherSession();

  try {
    await ensureBackendService();
    const result = await api.getSectionAnalytics(payload, getSessionToken());
    return { ok: true, configured: true, sections: result.sections || [], offline: false };
  } catch (error) {
    return {
      ok: true,
      configured: true,
      sections: getOfflineStore().buildSectionAnalytics(teacher.teacherId, payload.sectionCodes || [], payload.subjectCode),
      offline: true,
      message: error.message
    };
  }
});

ipcMain.handle("attendance:available-dates", async (_event, payload) => {
  const teacher = getCurrentTeacherSession();

  try {
    await ensureBackendService();
    const result = await api.getAvailableDates(payload, getSessionToken());
    getOfflineStore().updateSection(teacher.teacherId, payload.sectionCode, payload.subjectCode, {
      availableDates: result.dates || []
    });
    return { ok: true, configured: true, dates: result.dates || [], offline: false };
  } catch (error) {
    const section = getOfflineStore().getSection(teacher.teacherId, payload.sectionCode, payload.subjectCode);
    return {
      ok: true,
      configured: true,
      dates: section?.availableDates || [],
      offline: true,
      message: error.message
    };
  }
});

ipcMain.handle("attendance:load-section", async (_event, payload) => {
  const teacher = getCurrentTeacherSession();

  try {
    await ensureBackendService();
    const result = await api.loadSectionAttendance(payload, getSessionToken());
    getOfflineStore().updateSection(teacher.teacherId, payload.sectionCode, payload.subjectCode, {
      students: result.students || []
    });
    return { ok: true, configured: true, students: result.students || [], offline: false };
  } catch (error) {
    const section = getOfflineStore().getSection(teacher.teacherId, payload.sectionCode, payload.subjectCode);
    return {
      ok: true,
      configured: true,
      students: section?.students || [],
      offline: true,
      message: error.message
    };
  }
});

ipcMain.handle("attendance:save-date", async (_event, payload) => {
  const teacher = getCurrentTeacherSession();

  try {
    await ensureBackendService();
    if (!sessionToken) {
      throw new Error("No live session token is available.");
    }

    await flushQueuedAttendance(teacher.teacherId);
    const result = await api.saveAttendanceDate(payload, getSessionToken());
    getOfflineStore().applyAttendanceEntries(teacher.teacherId, payload.sectionCode, payload.subjectCode, payload.attendanceDate, payload.entries || []);
    await refreshCachedSections(teacher.teacherId, currentTeacherSession);

    return {
      ok: true,
      configured: true,
      offline: false,
      absentees: result.absentees || []
    };
  } catch (error) {
    getOfflineStore().queueAttendance(teacher.teacherId, teacher.name, payload);
    return {
      ok: true,
      configured: true,
      offline: true,
      queued: true,
      queuedCount: getOfflineStore().getQueuedCount(teacher.teacherId),
      message: "Attendance saved offline and queued for sync.",
      absentees: getOfflineStore().buildAbsenteesForDate(teacher.teacherId, payload.sectionCode, payload.subjectCode, payload.attendanceDate)
    };
  }
});

ipcMain.handle("system:open-external", async (_event, target) => {
  if (!target || typeof target !== "string") {
    return { ok: false, message: "Invalid external target." };
  }

  try {
    await shell.openExternal(target);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("messaging:send-absentees-sms", async (_event, payload) => {
  try {
    const result = await sendAbsenteeSms({
      absentees: payload?.absentees || [],
      sectionCode: payload?.sectionCode || "",
      attendanceDate: payload?.attendanceDate || "",
      subjectName: payload?.subjectName || ""
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      results: [],
      message: error.message
    };
  }
});

ipcMain.handle("attendance:reset-date", async (_event, payload) => {
  const teacher = getCurrentTeacherSession();

  try {
    await ensureBackendService();
    await api.resetAttendanceDate(payload, getSessionToken());
    getOfflineStore().removeQueuedAttendance(teacher.teacherId, payload.sectionCode, payload.attendanceDate, payload.subjectCode);
    getOfflineStore().clearAttendanceDate(teacher.teacherId, payload.sectionCode, payload.subjectCode, payload.attendanceDate);
    await refreshCachedSections(teacher.teacherId, currentTeacherSession);

    return { ok: true, configured: true, offline: false };
  } catch (error) {
    getOfflineStore().removeQueuedAttendance(teacher.teacherId, payload.sectionCode, payload.attendanceDate, payload.subjectCode);
    getOfflineStore().clearAttendanceDate(teacher.teacherId, payload.sectionCode, payload.subjectCode, payload.attendanceDate);

    return {
      ok: true,
      configured: true,
      offline: true,
      queued: true,
      message: "Date cleared locally. Save attendance again when you are ready to sync it online."
    };
  }
});

app.whenReady().then(async () => {
  getOfflineStore();
  app.setAppUserModelId("com.snpsu.teacherdesktop");

  try {
    await ensureBackendService();
  } catch (error) {
    logMainProcessError("Backend startup warning", error);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

process.on("uncaughtException", (error) => {
  logMainProcessError("Main process uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  logMainProcessError("Main process unhandled rejection", reason);
});

app.on("before-quit", () => {
  sessionToken = null;
  currentTeacherSession = null;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
